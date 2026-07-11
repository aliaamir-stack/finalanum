code = """
# ─── SUPERADMIN CRUD OPERATIONS ───────────────────────────────────────────────
@router.put("/api/transactions/{txn_id}", response_model=schemas.TransactionOut)
def update_transaction(txn_id: int, payload: schemas.TransactionCreate,
                       db: Session = Depends(get_db), user: models.User = Depends(require_super_admin)):
    txn = db.query(models.Transaction).filter(models.Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    was_approved = txn.status == models.TransactionStatus.approved

    if was_approved:
        _reverse_treasury_effect(db, txn)
        
    old_amount = txn.amount
    
    # Update fields
    txn.amount = payload.amount
    txn.type = payload.type
    txn.category = payload.category
    txn.notes = payload.notes
    txn.expense_description = payload.expense_description
    txn.expense_details = payload.expense_details
    txn.credited_to = payload.credited_to
    txn.transfer_from = payload.transfer_from
    if payload.date:
        txn.date = payload.date
        
    if was_approved:
        _apply_treasury_effect(db, txn)
        
    _audit(db, models.AuditAction.verified, "transaction", txn.id, user, 
           {"event": "edited", "old_amount": str(old_amount), "new_amount": str(txn.amount)})
           
    db.commit()
    db.refresh(txn)
    return txn

@router.delete("/api/transactions/{txn_id}")
def delete_transaction(txn_id: int, db: Session = Depends(get_db), 
                       user: models.User = Depends(require_super_admin)):
    txn = db.query(models.Transaction).filter(models.Transaction.id == txn_id).first()
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
        
    if txn.status == models.TransactionStatus.approved:
        _reverse_treasury_effect(db, txn)
        
    # Also fix occupant last_paid_month if it was a maintenance receipt
    if txn.occupant_id and txn.category == models.TransactionCategory.maintenance and txn.status == models.TransactionStatus.approved:
        occupant = db.query(models.Occupant).filter(models.Occupant.id == txn.occupant_id).first()
        if occupant and occupant.last_paid_month and txn.date:
            from sqlalchemy import func
            latest_other = (
                db.query(func.max(models.Transaction.date))
                .filter(
                    models.Transaction.occupant_id == txn.occupant_id,
                    models.Transaction.category == models.TransactionCategory.maintenance,
                    models.Transaction.status == models.TransactionStatus.approved,
                    models.Transaction.id != txn.id,
                )
                .scalar()
            )
            occupant.last_paid_month = latest_other
            db.add(occupant)
            
    db.delete(txn)
    _audit(db, models.AuditAction.cancelled, "transaction", txn_id, user, {"event": "deleted", "amount": str(txn.amount)})
    db.commit()
    return {"ok": True, "message": "Transaction deleted successfully"}
"""

with open("e:/AnumVista-fullstackSecondVersion/Anum-Vista-backend/backend/approval_endpoints.py", "a", encoding="utf-8") as f:
    f.write(code)
