import subprocess
from pathlib import Path
from fastapi import APIRouter
from fastapi.responses import StreamingResponse

router = APIRouter()

REPO_ROOT = Path(__file__).parent.parent.parent.parent


@router.post("/api/publish")
def publish():
    def stream():
        proc = subprocess.Popen(
            ["bash", "publish.sh"],
            cwd=str(REPO_ROOT),
            stdout=subprocess.PIPE,
            stderr=subprocess.STDOUT,
            text=True,
        )
        for line in proc.stdout:
            yield line
        proc.wait()
        if proc.returncode != 0:
            yield f"\nERROR: publish.sh exited with code {proc.returncode}\n"
        else:
            yield "\nDone!\n"

    return StreamingResponse(stream(), media_type="text/plain")
