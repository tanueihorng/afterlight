# Keeping your record safe

**Read this one.** Losing everything is not a rare disaster here — it is the ordinary failure, and
it happens quietly.

---

## The one thing you need to know

Your record lives in your browser's storage, on this device. That is what makes it private: there is
no server, no account, and nobody else has a copy — including whoever wrote this.

It is also what makes it fragile. All of these delete it, with no warning and no way back:

- clearing your browsing data, cookies or "site data";
- a browser or an operating system doing that during a cleanup;
- using a private / incognito window (it is gone when you close it);
- a new phone or laptop, or a wiped one;
- iOS clearing storage for a site you have not opened in a while — **this one catches people**,
  because it happens without you doing anything (see below).

**An export is the only copy that survives any of that.** Make one, and keep making them.

## How to export

**Settings → Export everything (JSON).**

You get one file, `afterlight-export-YYYY-MM-DD.json`, containing every entry, every drawing, and
every scan and letter you have added, plus a checksum so a damaged file can be spotted.

Do it:

- now, before you have much to lose;
- after an appointment, when you have just added scans or letters;
- roughly monthly otherwise.

Afterlight tells you how long it has been and how many records have changed since. It does this once
a week at most, and it does not nag.

## Where to put the file

It is your whole eye history. Treat it like a medical document, because it is one.

**Good places**

- Your own cloud storage — iCloud Drive, Google Drive, Dropbox, OneDrive — in a folder you would
  find again.
- A USB stick or an external drive kept somewhere sensible.
- Emailed to yourself, if that is what you will actually do. An imperfect backup you make is worth
  more than a perfect one you do not.

**Two copies in two places** is the rule that has always worked. One on the device, one somewhere
else.

**Less good**

- The Downloads folder and nowhere else. It is the first thing people clear out.
- A shared family computer, unencrypted, if you would rather your record were not read.

## Should you put a passphrase on it?

Optional, and a real trade-off.

**With a passphrase**, the file is encrypted (AES-256-GCM, with the key stretched from your
passphrase over 250,000 rounds). If it ends up somewhere you did not intend, it is unreadable.

**If you forget the passphrase, the file is gone.** There is no recovery, no reset link, and no
support desk. That is what encryption without a server means.

A reasonable approach: encrypt the copy that leaves your control (cloud, email), leave the copy on
your own drive unencrypted, and keep the passphrase in whatever you already use to remember
passwords.

## Check that your backup actually works

**Settings → Test a backup file.**

It reads the file, verifies the checksum, and tells you what is in it — how many records, which
dates, how many scans. It changes nothing on your device.

Do this once, on your most recent export. An untested backup is a hope, not a backup.

## Moving to a new device

1. On the **old** device: Settings → Export everything. Get the file onto the new device however
   you normally move files.
2. On the **new** device: open Afterlight in the browser you intend to keep using, and skip the
   setup.
3. Settings → **Import a backup**. Choose the file.
4. Read the preview. It tells you what is in the file and what will happen before anything is
   written.
5. Choose **Replace** on a new, empty device. Choose **Merge** if there are already entries here you
   want to keep — merge keeps the newer version of any record that exists in both.
6. Check that your most recent entries are on the timeline, and that a scan opens.
7. Only then stop using the old device.

**Use the same browser each time.** Chrome and Safari on the same laptop are two separate stores
and will not see each other's records. If you install Afterlight to your home screen, use the
installed one from then on.

## Ask the browser to keep it

**Settings → Storage on this device** shows how much space your record uses and whether storage is
*persistent*.

Persistent storage means the browser has agreed not to evict your data when it is short of space.
Tap the button to ask for it. The browser decides, and it usually says yes to a site you have
installed to your home screen or use regularly.

**On an iPhone or iPad, this matters more than anywhere else.** Safari clears site data for
websites you have not visited for several weeks. Two things reduce that risk a lot:

- **Add Afterlight to your home screen** (Share → Add to Home Screen). Installed apps are treated
  differently from tabs.
- **Export monthly**, which you should be doing anyway.

## If something has already gone wrong

**The record is empty but you have an export.** Import it. Everything comes back, including the
scans.

**The record is empty and you have no export.** Before anything else: do not clear anything, do not
reinstall the browser, and check the other browsers on the device — records are per-browser, and it
is common to have been using a different one than you think. Check whether an old export is in your
Downloads folder. If none of that finds it, it is gone, and no one can recover it. This is the
honest cost of a tool with no server.

**An export will not import.** Afterlight tells you why: not an Afterlight file, damaged, or a
checksum mismatch. A file damaged in transit sometimes survives being re-downloaded from wherever
you stored it. If it was encrypted and the passphrase is refused, the passphrase is wrong — there is
no other failure mode, and no way around it.

**A file is too large to save.** The app says so rather than losing it silently. Free up space, or
export and then remove older scans you have copies of elsewhere.

---

## The short version

- Export today.
- Keep two copies, in two places.
- Test one of them.
- Export again after every appointment.
