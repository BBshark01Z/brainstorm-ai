@echo off
cd /d C:\Users\User\Downloads\neuropulse\reference-data\phase3_sleepstage
python debug3.py > debug_output.txt 2>&1
type debug_output.txt
