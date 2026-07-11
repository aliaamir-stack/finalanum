import pandas as pd
from datetime import datetime, date
import os
from decimal import Decimal

# Import DB and models
from database import engine, SessionLocal, Base
import models

def clean_value(val):
    if pd.isna(val) or val == ' ' or str(val).strip() == '':
        return None
    return val

def clean_amount(val):
    if pd.isna(val) or val == ' ' or str(val).strip() == '':
        return Decimal('0')
    try:
        val_str = str(val).replace(',', '').strip()
        return Decimal(val_str)
    except Exception:
        return Decimal('0')

def run_migration():
    print("Starting extended migration process...")
    print("Dropping and recreating database tables...")
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    excel_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "avfin.xlsx"))
    if not os.path.exists(excel_path):
        print(f"Error: {excel_path} not found.")
        return

    db = SessionLocal()
    try:
        # --- Funds Position (FP 2026 / FP 2025) into history tables ---
        def _ingest_fp(sheet_name: str) -> None:
            df_fp = pd.read_excel(excel_path, sheet_name=sheet_name, header=None)

            # Find header row that contains month dates.
            header_row_idx = None
            for i in range(min(25, len(df_fp))):
                if any(isinstance(x, datetime) for x in df_fp.iloc[i].tolist()):
                    header_row_idx = i
                    break
            if header_row_idx is None:
                return

            header_row = df_fp.iloc[header_row_idx].tolist()
            month_cols: list[tuple[int, date]] = []
            for col_idx, val in enumerate(header_row):
                if isinstance(val, datetime):
                    month_cols.append((col_idx, val.date().replace(day=1)))

            # In this workbook, some months appear twice; keep first occurrence per month.
            seen = set()
            filtered_month_cols: list[tuple[int, date]] = []
            for col_idx, period in month_cols:
                key = (period.year, period.month)
                if key in seen:
                    continue
                seen.add(key)
                filtered_month_cols.append((col_idx, period))

            section = None
            for r in range(header_row_idx + 1, len(df_fp)):
                row = df_fp.iloc[r]
                # Special-case: 'Funds in Hand' block has person names in column 2
                # and the label column (1) is empty.
                if section == "funds_in_hand":
                    person_raw = clean_value(row.iloc[2]) if len(row) > 2 else None
                    if person_raw is None:
                        continue
                    person = str(person_raw).strip()
                    if not person:
                        continue
                    for col_idx, period in filtered_month_cols:
                        value_col = col_idx + 2
                        amount = clean_amount(row.iloc[value_col]) if value_col < len(row) else Decimal("0")
                        db.add(
                            models.FundsInHandEntry(
                                period=period,
                                person=person,
                                amount=amount.quantize(Decimal("0.01")),
                            )
                        )
                    continue

                label = clean_value(row.iloc[1]) if len(row) > 1 else None
                if label is None:
                    continue

                label_str = str(label).strip()
                if not label_str or label_str.lower() in {"nan"}:
                    continue

                lower = label_str.lower()
                if "cash in hand - opening balance" in lower:
                    section = "opening_balance"
                    entry_label = "Cash in Hand - Opening Balance"
                elif lower == "inflow":
                    section = "inflow"
                    continue
                elif lower == "outflow":
                    section = "outflow"
                    continue
                elif "cash in hand - closing balance" in lower:
                    section = "closing_balance"
                    entry_label = "Cash in Hand - Closing Balance"
                elif lower == "funds in hand":
                    section = "funds_in_hand"
                    continue
                else:
                    entry_label = label_str

                if section is None:
                    continue

                for col_idx, period in filtered_month_cols:
                    value_col = col_idx + 2
                    amount = clean_amount(row.iloc[value_col]) if value_col < len(row) else Decimal("0")
                    db.add(
                        models.FundsPositionEntry(
                            period=period,
                            section=section,
                            label=entry_label,
                            amount=amount.quantize(Decimal("0.01")),
                        )
                    )

        # Load both years if present
        for fp_sheet in ["FP 2026", "FP 2025"]:
            try:
                _ingest_fp(fp_sheet)
            except Exception:
                pass

        print("Parsing Funds Breakup...")
        df_funds = pd.read_excel(excel_path, sheet_name='Funds Breakup', nrows=20) 
        for index, row in df_funds.iterrows():
            particulars = clean_value(row.iloc[1]) 
            amount = clean_amount(row.iloc[2]) 
            
            if particulars and 'Opening' in str(particulars) and amount > 0:
                txn = models.Transaction(
                    date=datetime(2024, 1, 1), 
                    amount=amount,
                    type=models.TransactionType.INFLOW,
                    category=models.TransactionCategory.other,
                    notes=str(particulars)
                )
                db.add(txn)
            elif particulars and 'Maintenance amount received' in str(particulars) and amount > 0:
                txn = models.Transaction(
                    date=datetime(2024, 1, 1),
                    amount=amount,
                    type=models.TransactionType.INFLOW,
                    category=models.TransactionCategory.other,
                    notes=str(particulars)
                )
                db.add(txn)
        db.commit()

        print("Parsing Advertisment...")
        df_adv = pd.read_excel(excel_path, sheet_name='Advertisment', skiprows=2)
        for index, row in df_adv.iterrows():
            duration = clean_value(row.iloc[1]) 
            name = clean_value(row.iloc[2]) 
            amount = clean_amount(row.iloc[3]) 
            
            if name and str(name).lower() != 'name' and str(name) != 'nan' and amount > 0:
                adv = db.query(models.Advertisement).filter(models.Advertisement.advertiser_name == str(name)).first()
                if not adv:
                    adv = models.Advertisement(advertiser_name=str(name), annual_fee=amount)
                    db.add(adv)
                    db.flush()
                
                txn = models.Transaction(
                    date=datetime(2021, 6, 1), 
                    amount=amount,
                    type=models.TransactionType.INFLOW,
                    category=models.TransactionCategory.ad_revenue,
                    notes=f"{name} - {duration}" if duration else str(name)
                )
                db.add(txn)
        db.commit()

        print("Parsing Recpt 2026...")
        # Sheet contains two side-by-side tables:
        # - Left: Residents receipts
        # - Right: consolidated outstanding position with the correct per-apartment maintenance
        df_recpt = pd.read_excel(excel_path, sheet_name='Recpt 2026', skiprows=4, header=None)

        # Build maintenance map from the consolidated table (right side).
        # Columns (0-based) based on file layout:
        # 16: Appartment No., 17: Name, 18: Monthly Maintenance (actually annual total in this dataset)
        monthly_fee_by_unit: dict[str, Decimal] = {}
        for _, row in df_recpt.iterrows():
            unit_raw = clean_value(row.iloc[16]) if len(row) > 16 else None
            annual_raw = clean_value(row.iloc[18]) if len(row) > 18 else None
            if unit_raw is None or annual_raw is None:
                continue
            unit_str = str(unit_raw).strip()
            if not unit_str or unit_str.lower() in {"appartment no.", "appartment", "apartment"}:
                continue
            try:
                annual = clean_amount(annual_raw)
                if annual <= 0:
                    continue
                monthly_fee_by_unit[unit_str] = (annual / Decimal("12")).quantize(Decimal("0.01"))
            except Exception:
                continue

        # Store the consolidated outstanding snapshot as-of Jan 31, 2026.
        as_of_snapshot = date(2026, 1, 31)
        for _, row in df_recpt.iterrows():
            unit_raw = clean_value(row.iloc[16]) if len(row) > 16 else None
            if unit_raw is None:
                continue
            unit_str = str(unit_raw).strip()
            if not unit_str or unit_str.lower() in {"appartment no.", "appartment", "apartment"}:
                continue

            resident = clean_value(row.iloc[17]) if len(row) > 17 else None
            annual_raw = clean_value(row.iloc[18]) if len(row) > 18 else None
            dues_dec = clean_value(row.iloc[19]) if len(row) > 19 else None
            maint_till = clean_value(row.iloc[20]) if len(row) > 20 else None
            received_yr = clean_value(row.iloc[21]) if len(row) > 21 else None
            dues_till = clean_value(row.iloc[22]) if len(row) > 22 else None

            if resident is None or annual_raw is None:
                continue

            db.add(
                models.OutstandingMaintenanceSnapshot(
                    as_of=as_of_snapshot,
                    unit_no=unit_str,
                    resident_name=str(resident).strip(),
                    annual_maintenance=clean_amount(annual_raw).quantize(Decimal("0.01")),
                    dues_till_dec_31=clean_amount(dues_dec).quantize(Decimal("0.01")),
                    maintenance_till_period=clean_amount(maint_till).quantize(Decimal("0.01")),
                    received_during_year=clean_amount(received_yr).quantize(Decimal("0.01")),
                    dues_till_period=clean_amount(dues_till).quantize(Decimal("0.01")),
                )
            )

        # Now parse the receipts table (left side).
        for index, row in df_recpt.iterrows():
            name = str(row.iloc[1]).strip() if clean_value(row.iloc[1]) else None
            unit_no = str(row.iloc[2]).strip() if clean_value(row.iloc[2]) else None

            if not name or name == 'nan' or name == 'Particulars' or not unit_no or unit_no == 'nan':
                continue

            unit = db.query(models.Unit).filter(models.Unit.unit_no == unit_no).first()
            if not unit:
                unit = models.Unit(unit_no=unit_no, type=models.UnitType.residential)
                db.add(unit)
                db.flush()

            occupant = db.query(models.Occupant).filter(
                models.Occupant.name == name, 
                models.Occupant.unit_id == unit.id
            ).first()
            if not occupant:
                derived_fee = monthly_fee_by_unit.get(unit_no)
                occupant = models.Occupant(
                    name=name,
                    unit_id=unit.id,
                    monthly_maintenance_fee=derived_fee if derived_fee is not None else Decimal("7000.00")
                )
                db.add(occupant)
                db.flush()

            for month_idx, start_col in enumerate(range(3, 15, 3)):
                amount = clean_amount(row.iloc[start_col])
                receipt_no = clean_value(row.iloc[start_col+1])
                date_val = clean_value(row.iloc[start_col+2])

                if amount > 0:
                    try:
                        parsed_date = pd.to_datetime(date_val) if pd.notnull(date_val) else datetime(2026, month_idx + 1, 1)
                    except Exception:
                        parsed_date = datetime(2026, month_idx + 1, 1)

                    txn = models.Transaction(
                        occupant_id=occupant.id,
                        receipt_no=str(receipt_no) if receipt_no else None,
                        date=parsed_date,
                        amount=amount,
                        type=models.TransactionType.INFLOW,
                        category=models.TransactionCategory.maintenance
                    )
                    db.add(txn)
                    
                    if not occupant.last_paid_month or parsed_date > occupant.last_paid_month:
                        occupant.last_paid_month = parsed_date
        db.commit()

        def _parse_receipts_sheet(sheet_name: str) -> None:
            df = pd.read_excel(excel_path, sheet_name=sheet_name, skiprows=4, header=None)

            # Determine month group start columns for the receipts table (left side).
            # Layout is: [.. name col=1, unit col=2 ..] then repeating groups:
            # amount, receipt_no, date for each month.
            header = df.iloc[0].tolist() if len(df) else []
            start_cols: list[int] = []
            for col in range(3, min(len(header), 140), 1):
                # candidate group start if we have (amount, receipt, date) columns
                if col + 2 >= len(header):
                    break
                # date header is usually a datetime at col+? but can be on the 'amount' column header itself
                if isinstance(header[col], datetime) and (header[col + 1] is None or str(header[col + 1]).lower() == "nan"):
                    start_cols.append(col)
            # Fallback: treat every 3 columns after 3 as a month group.
            if not start_cols:
                start_cols = list(range(3, df.shape[1], 3))

            for _, row in df.iterrows():
                name = str(row.iloc[1]).strip() if clean_value(row.iloc[1]) else None
                unit_no = str(row.iloc[2]).strip() if clean_value(row.iloc[2]) else None
                if not name or name == 'nan' or name == 'Particulars' or not unit_no or unit_no == 'nan':
                    continue

                unit = db.query(models.Unit).filter(models.Unit.unit_no == unit_no).first()
                if not unit:
                    unit = models.Unit(unit_no=unit_no, type=models.UnitType.residential)
                    db.add(unit)
                    db.flush()

                occupant = db.query(models.Occupant).filter(
                    models.Occupant.name == name,
                    models.Occupant.unit_id == unit.id
                ).first()
                if not occupant:
                    derived_fee = monthly_fee_by_unit.get(unit_no)
                    occupant = models.Occupant(
                        name=name,
                        unit_id=unit.id,
                        monthly_maintenance_fee=derived_fee if derived_fee is not None else Decimal("7000.00")
                    )
                    db.add(occupant)
                    db.flush()

                for start_col in start_cols:
                    if start_col + 2 >= len(row):
                        continue
                    amount = clean_amount(row.iloc[start_col])
                    receipt_no = clean_value(row.iloc[start_col + 1])
                    date_val = clean_value(row.iloc[start_col + 2])
                    if amount <= 0:
                        continue
                    try:
                        parsed_date = pd.to_datetime(date_val) if pd.notnull(date_val) else None
                    except Exception:
                        parsed_date = None
                    if parsed_date is None:
                        # best-effort: infer from header if possible
                        try:
                            hdr = header[start_col]
                            if isinstance(hdr, datetime):
                                parsed_date = hdr
                            else:
                                parsed_date = datetime(2025, 1, 1)
                        except Exception:
                            parsed_date = datetime(2025, 1, 1)

                    txn = models.Transaction(
                        occupant_id=occupant.id,
                        receipt_no=str(receipt_no) if receipt_no else None,
                        date=parsed_date,
                        amount=amount,
                        type=models.TransactionType.INFLOW,
                        category=models.TransactionCategory.maintenance
                    )
                    db.add(txn)
                    if not occupant.last_paid_month or parsed_date > occupant.last_paid_month:
                        occupant.last_paid_month = parsed_date

            db.commit()

        print("Parsing Recpt 2025 (historical receipts)...")
        _parse_receipts_sheet("Recpt 2025")

        print("Parsing Exp 2026...")
        df_exp = pd.read_excel(excel_path, sheet_name='Exp 2026', skiprows=3)

        # Seed dropdown descriptions for the Expenses form
        seen_desc: set[str] = set()
        for _, row in df_exp.iterrows():
            desc = clean_value(row.iloc[1])
            if not desc:
                continue
            desc_str = str(desc).strip()
            if not desc_str or desc_str.lower() in {"discription", "description", "nan"}:
                continue
            if desc_str in seen_desc:
                continue
            seen_desc.add(desc_str)
            db.add(models.ExpenseDescription(description=desc_str))
        db.flush()

        for index, row in df_exp.iterrows():
            desc = clean_value(row.iloc[1])
            left_amount = clean_amount(row.iloc[4])
            left_date_val = clean_value(row.iloc[5])

            if desc and str(desc).lower() != 'discription' and str(desc) != 'nan' and left_amount > 0:
                try:
                    left_parsed_date = pd.to_datetime(left_date_val) if pd.notnull(left_date_val) else datetime(2026, 1, 1)
                except:
                    left_parsed_date = datetime(2026, 1, 1)
                
                txn_left = models.Transaction(
                    date=left_parsed_date,
                    amount=left_amount,
                    type=models.TransactionType.OUTFLOW,
                    category=models.TransactionCategory.expense,
                    notes=str(desc),
                    expense_description=str(desc) if desc else None,
                )
                db.add(txn_left)
            
            try:
                petty_desc = clean_value(row.iloc[12])
                petty_date_val = clean_value(row.iloc[13])
                petty_amount = clean_amount(row.iloc[14])

                if petty_desc and str(petty_desc).lower() != 'particulors' and str(petty_desc) != 'nan' and petty_amount > 0:
                    try:
                        right_parsed_date = pd.to_datetime(petty_date_val) if pd.notnull(petty_date_val) else datetime(2026, 1, 1)
                    except:
                        right_parsed_date = datetime(2026, 1, 1)
                    
                    txn_right = models.Transaction(
                        date=right_parsed_date,
                        amount=petty_amount,
                        type=models.TransactionType.OUTFLOW,
                        category=models.TransactionCategory.expense,
                        notes=f"Petty: {petty_desc}",
                        expense_description=str(petty_desc) if petty_desc else None,
                    )
                    db.add(txn_right)
            except IndexError:
                pass 

        db.commit()
        print("Successfully completed extended migration!")

    except Exception as e:
        db.rollback()
        print(f"Error during extended migration: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    run_migration()
