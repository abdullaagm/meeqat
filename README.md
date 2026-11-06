# Meeqat: Prayer Time Display for TV + Phone Control

A prayer-times screen with a glass-style design for a **masjid or home**. The TV shows the times, and you change everything from your **phone**.
It works **offline** on local Wi-Fi and **online** from anywhere, and you can give it to as many masjids as you like.

---

## What's included

| On the TV | From the phone (`/admin`) |
|---|---|
| Large clock, Gregorian + Hijri date | Iqamah: minutes after adhan, or a fixed time, with +/- buttons |
| Next-prayer card with countdown and progress bar | Jumu'ah khutbah and iqamah times |
| 6 prayer cards (landscape) or a timetable list (portrait TV) | Urgent full-screen message (Janazah, etc.) with an auto-expiry time |
| Iqamah under every prayer, "Now" and "Tomorrow" tags | Scrolling announcements with date ranges |
| Full-screen **adhan alert** + optional adhan sound | Ayah / hadith list |
| Large **iqamah countdown** ("Straighten your rows") | Each feature has its own **ON/OFF switch**, plus Home / Masjid presets |
| Dark **"Salah in progress"** and **"Khutbah"** screens | City presets (Kerala, India, GCC, world), calculation method, Asr madhab, ± minute adjustments |
| Ramadan strip: Suhoor, Imsak, Iftar countdown, Taraweeh | Hijri ±day adjustment, Hijri date changes at Maghrib |
| Rotating ayah, announcements ticker | Theme, accent colour, orientation, performance mode |
| Background that changes with the prayer time, plus 6 fixed themes | Upload adhan / Fajr adhan / iqamah sound |
| QR code: scan to control | Test adhan / iqamah / salah screen, identify TV, reload TV, turn the screen black |
| Burn-in protection, night dimming, keeps the screen awake | Set the TV clock from your phone; monthly timetable you can print or save as PDF |
| 10 languages: English, العربية, മലയാളം, اردو, हिन्दी, தமிழ், বাংলা, Indonesia, Türkçe, Français | Change PIN, create screens for other masjids, export/import backup |

Prayer times are **calculated on the device** with the open-source *adhan* library, so no internet is needed.

---

## Option A: Masjid, works fully offline (recommended)

You need a small always-on computer on the masjid Wi-Fi: a **Raspberry Pi 4/5** (best), an old PC/laptop, or an Android phone running Termux.

1. Install **Node.js 16 or newer** (`sudo apt install nodejs` on a Pi; from nodejs.org on Windows).
2. Copy this folder to the computer and run:
   - Windows: double-click `start-windows.bat`
   - Pi / Linux / Mac: `./start.sh` (or `node server.js`)
3. The window prints two links, for example:
   ```
   On Wi-Fi    : http://192.168.1.20:8080/        (open on the TV)
   Phone admin : http://192.168.1.20:8080/admin   (open on your phone)
   ```
4. **TV:** open the first link full-screen. On an Android TV or Fire TV Stick, use a kiosk browser such as *Fully Kiosk Browser* and set it as the start page. On a Raspberry Pi, the TV can run on the Pi itself at `http://localhost:8080`.
5. **Phone:** scan the QR code on the TV, or open the admin link. Screen ID `main`, default PIN **1234**. **Change the PIN** in Settings › Security.

Changes from the phone appear on the TV within about a second. If the Wi-Fi drops, the TV keeps running with its last saved settings.

> **Raspberry Pi without internet:** a Pi has no battery clock. Use **Home › Clock › "Set TV clock from this phone"** or add a DS3231 RTC module (about ₹300).

**Auto-start on a Raspberry Pi** (one time):
```bash
sudo npm i -g pm2 && pm2 start server.js --name meeqat && pm2 save && pm2 startup
# Chromium kiosk on boot: add to ~/.config/lxsession/LXDE-pi/autostart
@chromium-browser --kiosk --noerrdialogs --autoplay-policy=no-user-gesture-required http://localhost:8080
```

## Option B: Live on the web (Railway API + Netlify site)

```
 TV / phone browser ──►  https://<your-site>.netlify.app        (pages: display + /admin)
                              │  fetch + live updates (HTTPS, CORS)
                              ▼
                         https://<your-api>.up.railway.app      (server.js + /data volume)
```

**1. GitHub:** push this folder to `abdullaagm/meeqat` (private is fine).

**2. Railway (API, about $5/month, always on):**
1. railway.com › New Project › *Deploy from GitHub repo* › `abdullaagm/meeqat`. It builds from the `Dockerfile` automatically.
2. Service › **Volumes** › *Add volume*, mount path **`/data`**. Without it, settings are lost on every redeploy.
3. Service › **Variables**:
   - `DEFAULT_PIN` = a 6-digit PIN of your choice. If you don't set one, a random PIN is printed in the Deploy logs.
   - `ALLOWED_ORIGINS` = `https://<your-site>.netlify.app` (add it after step 3).
4. Service › Settings › Networking › **Generate Domain**, which gives you e.g. `https://meeqat-production.up.railway.app`.
   Check that `https://…up.railway.app/healthz` returns `{"app":"Meeqat",…}`.

**3. Netlify (website, free):**
1. app.netlify.com › *Add new site* › *Import from Git* › `abdullaagm/meeqat`. Build settings are read from `netlify.toml`.
2. Site configuration › Environment variables › **`MIQAT_API`** = your Railway URL (no trailing slash).
3. Deploy, then rename the site under Site configuration › Change site name (e.g. `meeqat.netlify.app`).
4. Put that Netlify address into Railway's `ALLOWED_ORIGINS` (step 2.3).

**4. Use it:**
- TV: `https://<site>.netlify.app/`, or `/?s=<screen-id>` for a specific masjid
- Phone: `https://<site>.netlify.app/admin`, Screen ID `main` plus your PIN

Every push to GitHub redeploys both services. Over HTTPS the display installs as an app and caches itself, so the TV **keeps running if the internet drops** and reconnects by itself.

**Only Railway?** Skip Netlify and open the Railway URL directly. It serves the pages too.

**Security on the public web:**
- The PIN is required for every change, and 8 wrong tries lock that device out for 5 minutes.
- New screens can only be created by a logged-in admin (`ALLOW_NEW_SCREENS=admins`).
- Set `ALLOW_NEW_SCREENS=1` only if you want anyone to sign up, or `0` to disable new screens.

## Option C: One device, no server

Open `public/index.html` directly, or put the `public` folder on any static host. Settings are saved in that browser. Press **S** on a keyboard to open the settings page. Phone control needs Option A or B.

---

## Giving it to others

- **Same server:** log in, then Settings › *Share & screens* › **Create**. Each masjid gets its own **Screen ID + PIN** and its own links:
  `…/?s=masjid-al-huda-1a2b` (TV) and `…/admin?s=masjid-al-huda-1a2b` (phone).
- **Their own server:** give them this folder. It needs no accounts and no fees.
- Server variables: `PORT` (8080), `DATA_DIR` (./data), `DEFAULT_PIN` (1234 locally, random on cloud), `ALLOW_NEW_SCREENS` (`admins` default / `1` / `0`), `ALLOWED_ORIGINS` (default any).

## Tips

- **Kerala:** Karachi method + Shafi'i Asr is preselected for Kerala cities. Use the ±minute adjustments to match your Samastha / KNM / local calendar exactly, and use the Hijri ±day setting when the moon sighting differs.
- **Sound on a TV:** browsers block sound until the remote is pressed once. Press **OK** when the "enable adhan sound" chip appears, or use Fully Kiosk with "autoplay" enabled.
- **Slow TV stick?** Turn on Features › *Performance mode*.
- **Vertical TV?** Settings › Look › Orientation › Portrait (it's also detected automatically).

## Files

```
server.js            zero-dependency Node server (API, live push, audio, multi-screen)
netlify.toml         Netlify site config (+ scripts/netlify-config.js writes public/config.js)
railway.json         Railway deploy config (Dockerfile, /healthz)
public/config.js     API address ('' = same server)
public/index.html    TV display
public/admin.html    phone control panel
public/shared.js     prayer calculation, languages, sync
public/vendor/       adhan.js (MIT), qrcode-generator (MIT)
public/fonts/        Outfit, Amiri, Noto Sans Malayalam (SIL Open Font License)
data/                created at runtime: settings + uploaded audio (back this up)
```

Licences: adhan.js and qrcode-generator are MIT. The fonts are under the SIL OFL. Upload only adhan recordings you have permission to use.
