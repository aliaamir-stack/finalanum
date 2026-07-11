# Anum Vista — Offline User Guide

## How it Works Without Internet

This application runs **entirely on your local office network**. No internet is required — ever.

All data is saved to a database file on the **main server PC**. As long as that PC is on and the app is running, all treasurers can connect from their own laptops using the office Wi-Fi.

---

## Setup Instructions

### Step 1: On the Main Server PC (Run Once)

1. Open the folder `AnumVista-fullstackSecondVersion`
2. Double-click **`START_ANUM_VISTA.bat`**
3. Wait for both windows to open (takes about 15 seconds)
4. A browser will open automatically with the app

You will see a screen like this:
```
  This PC (Server):   http://localhost:3000
  Other Devices:      http://192.168.1.50:3000   ← share this with everyone
```

> **Write down or share the "Other Devices" address with all treasurers.**

---

### Step 2: On Other Laptops (Treasurers)

1. Make sure you are connected to the **same Wi-Fi network** as the server PC
2. Open any browser (Chrome, Edge, Firefox)
3. Type the address shown on the server screen (e.g., `http://192.168.1.50:3000`)
4. Log in with your personal credentials

---

### Step 3 (Optional): Auto-Start When PC Turns On

Run **`SETUP_AUTOSTART.bat`** once on the server PC. After that, the app will start automatically every time Windows starts — no manual action needed.

---

## Login Credentials

| Username   | Password    | Role         |
|------------|-------------|--------------|
| `admin`    | `admin123`  | Admin (Receptionist) |
| `Naveed`   | `naveed123` | SuperAdmin (Treasurer) |
| `Asif`     | `asif123`   | SuperAdmin (Treasurer) |
| `Dilshad`  | `dilshad123`| SuperAdmin (Treasurer) |
| `Ali`      | `ali123`    | SuperAdmin (Treasurer) |
| `Danish`   | `danish123` | SuperAdmin (Treasurer) |

> **Change passwords after first login for security.**

---

## Data Safety

- All data is stored in `Anum-Vista-backend/backend/anum_vista.db`
- **Backup this file regularly** by copying it to a USB drive
- Data is never lost when the app is stopped or the PC restarts

---

## Stopping the App

Double-click **`STOP_ANUM_VISTA.bat`** to cleanly shut down both servers.

---

## Troubleshooting

| Problem | Solution |
|---------|----------|
| Other laptops can't connect | Make sure everyone is on the same Wi-Fi. Check the IP address shown on the server. |
| App won't start | Make sure Python and Node.js are installed. Run `START_ANUM_VISTA.bat` as Administrator. |
| Browser shows error on startup | Wait 10–15 more seconds and refresh. The backend needs time to initialize. |
| Port already in use | Run `STOP_ANUM_VISTA.bat` first, then restart. |
