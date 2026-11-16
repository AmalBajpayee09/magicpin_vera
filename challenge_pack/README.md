# Official challenge materials

The 16 files from the separately supplied official ZIP are preserved byte-for-byte. `../docs/OFFICIAL_SHA256.json` records their hashes. This README and `submission.jsonl` are project support files, not original official files.

From the project root, run `python scripts/verify_official.py` to verify originals, `python challenge_pack/dataset/generate_dataset.py --seed-dir challenge_pack/dataset --out challenge_pack/expanded` to generate fixtures, and `python scripts/run_official_judge.py warmup` to configure and run the original simulator's warmup against the running bot. Scoring requires a separately supplied provider credential; see the setup guide. Do not edit the simulator or official dataset to improve results.
