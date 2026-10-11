# Security

This local application handles screen/audio/video media and writes files chosen by the user. The renderer has no Node integration, is sandboxed, and uses a restrictive CSP and context-isolated, sender-validated preload bridge. File open/reveal actions are restricted to application recording history. FFmpeg selection is validated through a native picker; it is launched without a shell and with fixed arguments.

Do not post recordings or credentials in public bug reports. Ordinary bugs can be reported in [GitHub Issues](https://github.com/Harley7891/ClearCapture/issues). For a vulnerability, privately contact the maintainer of the repository you obtained this software from. A dedicated private security mailbox or advisory channel has not yet been configured; do not publish exploit details or sensitive data in an issue.

0.1 is unsigned and has not had a formal security audit. Abrupt process termination, power loss and disk faults may leave a `.partial.webm`; preserve it for recovery. The application never deletes an unrelated output file to recover a recording.
