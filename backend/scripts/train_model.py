"""CLI entry point for TS-Transformer training."""

import logging
import sys
from pathlib import Path

# Ensure backend root is on sys.path
BACKEND_ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND_ROOT))

from ai.training.runner import run_training  # noqa: E402

if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s | %(message)s")
    result = run_training()
    print(
        f"\nTraining finished.\n"
        f"  Accuracy : {result['accuracy_pct']}%\n"
        f"  MAPE     : {result['mape']}%\n"
        f"  RMSE     : {result['rmse']}\n"
        f"  MAE      : {result['mae']}\n"
        f"  R²       : {result['r2']}\n"
        f"  Epochs   : {result['epochs_trained']}\n"
        f"  Checkpoint: {result['checkpoint_path']}"
    )
    if result["accuracy_pct"] < 75:
        sys.exit(1)