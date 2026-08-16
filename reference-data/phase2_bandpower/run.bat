@echo off
cd /d C:\Users\User\Downloads\neuropulse
python reference-data/phase2_bandpower/phase2_bandpower.py > reference-data/phase2_bandpower/output.txt 2>&1
echo SCRIPT_COMPLETED
