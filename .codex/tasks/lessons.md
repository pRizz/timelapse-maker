## lesson-verify-source-file-before-diagnosis | 2026-06-24 23:42

1. Date: 2026-06-24 23:42 CDT
2. What went wrong: I analyzed `/Users/peterryszkiewicz/Downloads/IMG_8147-timelapse.mp4` before the user corrected that the original reproduction file was `/Users/peterryszkiewicz/Downloads/IMG_8147.MOV`.
3. Preventive rule: When a task distinguishes original inputs from generated outputs, verify the referenced file role before drawing conclusions from media metadata.
4. Trigger signal to catch it earlier: A filename suffix such as `-timelapse` or other output-like naming should prompt a source/output role check before diagnosis.
