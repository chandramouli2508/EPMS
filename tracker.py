
import csv
import time
from datetime import datetime
from pathlib import Path

import psutil
import win32gui
import win32process

OUTPUT = Path(r"D:\Chandra\EPMS\activity_log.csv")
CHECK_SECONDS = 1
TARGET_PROCESS = "gcad.exe"


def timestamp():
    return datetime.now().isoformat(timespec="seconds")


def find_gstarcad_processes():
    processes = []

    for proc in psutil.process_iter(["pid", "name", "exe"]):
        try:
            if (proc.info["name"] or "").lower() == TARGET_PROCESS:
                processes.append({
                    "pid": proc.info["pid"],
                    "name": proc.info["name"],
                })
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            continue

    return processes


def get_gstarcad_foreground():
    hwnd = win32gui.GetForegroundWindow()

    if not hwnd:
        return None

    _, pid = win32process.GetWindowThreadProcessId(hwnd)

    try:
        proc = psutil.Process(pid)

        if proc.name().lower() != TARGET_PROCESS:
            return None

        return {
            "pid": pid,
            "name": proc.name(),
            "title": win32gui.GetWindowText(hwnd),
        }
    except (psutil.NoSuchProcess, psutil.AccessDenied):
        return None


def main():
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    file_exists = OUTPUT.exists() and OUTPUT.stat().st_size > 0

    with OUTPUT.open("a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)

        if not file_exists:
            writer.writerow([
                "timestamp",
                "event",
                "pid",
                "application",
                "window_title",
            ])

        previous_pids = set()
        previous_window = None

        print("GstarCAD 2019 tracker started.")
        print("Open and close GstarCAD to test.")
        print("Press Ctrl+C to stop.")
        print(f"Log file: {OUTPUT}")

        try:
            while True:
                processes = find_gstarcad_processes()
                current_pids = {p["pid"] for p in processes}

                for proc in processes:
                    if proc["pid"] not in previous_pids:
                        writer.writerow([
                            timestamp(), "PROCESS_STARTED",
                            proc["pid"], proc["name"], "",
                        ])
                        file.flush()
                        print("GstarCAD detected as running.")

                for pid in previous_pids - current_pids:
                    writer.writerow([
                        timestamp(), "PROCESS_STOPPED",
                        pid, TARGET_PROCESS, "",
                    ])
                    file.flush()
                    print("GstarCAD process stopped.")

                window = get_gstarcad_foreground()

                if window:
                    current_window = (window["pid"], window["title"])

                    if current_window != previous_window:
                        writer.writerow([
                            timestamp(), "FOREGROUND_WINDOW",
                            window["pid"], window["name"],
                            window["title"],
                        ])
                        file.flush()
                        print("GstarCAD window:", window["title"])

                    previous_window = current_window
                else:
                    previous_window = None

                previous_pids = current_pids
                time.sleep(CHECK_SECONDS)

        except KeyboardInterrupt:
            print("\nTracker stopped.")


if __name__ == "__main__":
    main()
