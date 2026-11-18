# Margin documentation

Project documentation for CSE3005 Software Engineering. Markdown files are the editable sources. Optional generated Word copies of the individual documents stay local. The [final report](../reports/Margin_Software_Engineering_Project_Report.pdf) and its [Word version](../reports/Margin_Software_Engineering_Project_Report.docx) are published separately. Requirement IDs (FR-xx, NFR-xx), test case IDs (TC-xx) and figure numbers are shared across the companion documents.

| Course topic | Document | Main contents |
| --- | --- | --- |
| Requirements | [01-SRS/SRS.md](01-SRS/SRS.md) | Problem, solution, actors, 29 functional and 15 non-functional requirements, constraints, MoSCoW, acceptance criteria |
| Design | [02-Software-Design/Software-Design.md](02-Software-Design/Software-Design.md) | Architecture, REST API, use-case, class, sequence and state diagrams, context and level 0/1 DFDs, database design, design principles |
| SDLC | [03-SDLC/SDLC.md](03-SDLC/SDLC.md) | Iterative incremental model, why it was chosen, phases as carried out |
| Coding and testing | [04-Testing/Test-Plan-and-Report.md](04-Testing/Test-Plan-and-Report.md) | Test levels, 48 test cases with results, security, performance, regression |
| Traceability | [04-Testing/Traceability-Matrix.md](04-Testing/Traceability-Matrix.md) | Requirement → design → code → test → status |
| Project management | [05-Project-Management/Project-Management.md](05-Project-Management/Project-Management.md) | WBS, effort (PERT, COCOMO), schedule, PERT chart, CPM, cost, risks, monitoring |
| Quality and maintenance | [06-Quality-and-Maintenance/Quality-and-Maintenance.md](06-Quality-and-Maintenance/Quality-and-Maintenance.md) | QA, QC, maintenance types with examples, reverse engineering, change management, security |

Supporting files:

- `02-Software-Design/diagrams/`: every figure as SVG and PNG. Sources are in `diagrams/src`; `render.mjs` redraws them and stops if a DFD level is unbalanced.
- `04-Testing/evidence/`: sanitised API and browser output from the 6 November baseline, its build, dependency audit and performance records, and the [18 November publication checks](04-Testing/evidence/publication-checks-2026-11-18.md). Reset-link values are removed from published output. The dated results describe their respective runs.
- `05-Project-Management/pert-cpm.mjs`: PERT and CPM calculations with self-checks; `pert-cpm-output.md` is its output.
- `build-docx.cjs`: regenerates the Word files from the Markdown sources.

To regenerate the companion diagrams, install Chromium as described in the main README, then run `node docs/02-Software-Design/diagrams/src/render.mjs`. Run `node docs/05-Project-Management/pert-cpm.mjs` to reproduce the planning calculations. Optional Word export instructions are at the top of `build-docx.cjs`; they require the additional local `docx` package.

The companion design uses a detailed process decomposition. The final report uses a compact overview and its own figure numbering. The report's corrected DFD drawings are also available as [Level 0 SVG](../reports/assets/dfd-level0.svg) and [trading Level 1 SVG](../reports/assets/dfd-level1-trade.svg). The [database guide](../reports/MongoDB_Schema_Explanation.md) documents the current models and live index inspection.

The submitted report cites the earlier public snapshot `5ed88fe`. Its 17 November results also cover the cancellation fix and Browse assertion subsequently published with this documentation. Use the 18 November verification record above when reproducing the current repository.
