"""Reject AI identities in commit authorship and co-author trailers."""
import re
import subprocess
import sys

AI = re.compile(r"\b(?:claude|codex|anthropic|openai)\b", re.I)


def check_identity(value, label):
    if AI.search(value):
        raise ValueError(f"{label} credits an AI assistant: {value}")


def check_message(message, label):
    for line in message.splitlines():
        if re.match(r"\s*co-authored-by\s*:", line, re.I):
            check_identity(line, label)


def main():
    for sha in subprocess.check_output(
        ["git", "rev-list", "HEAD"], text=True
    ).splitlines():
        metadata = subprocess.check_output(
            ["git", "show", "-s", "--format=%an <%ae>%n%cn <%ce>%n%B", sha],
            text=True,
        ).split("\n", 2)
        check_identity(metadata[0], f"{sha} author")
        check_identity(metadata[1], f"{sha} committer")
        check_message(metadata[2], f"{sha} message")
    # Include PR text because GitHub can use it as the squash commit message.
    if len(sys.argv) > 1:
        import json
        with open(sys.argv[1]) as event_file:
            pr = json.load(event_file).get("pull_request", {})
        check_message(pr.get("title", "") + "\n" + (pr.get("body") or ""), "Pull request")
    print("Commit attribution contains no Claude or Codex identities.")


if __name__ == "__main__":
    try:
        main()
    except ValueError as error:
        sys.exit(str(error))
