# Publication verification — 18 November 2026

These checks were executed for the final GitHub publication using Node.js 26.8.1 and the existing local MongoDB server. The API and browser suites used their dedicated test databases. Their fixtures were reset by the normal test setup.

| Check | Actual result | Evidence |
| --- | --- | --- |
| Production frontend build | Passed, 61 modules transformed | [Build output](build-2026-11-18.sanitized.txt) |
| API tests | 67 passed, zero failures, zero skips | [API output](api-tests-2026-11-18.sanitized.txt) |
| Chromium browser tests | 16 passed, zero failures | [Browser output](browser-tests-2026-11-18.sanitized.txt) |
| Production dependency audit | Zero reported vulnerabilities | [Audit output](dependency-audit-2026-11-18.sanitized.txt) |
| DFD generators | Context, Level 0, trading Level 1 and moderation Level 1 generators passed their balancing assertions | Existing diagram source checks |
| PERT/CPM calculations | Completed with the existing self-checks | Existing planning script |

The API run includes the cancellation-before-acceptance case, both controlled acceptance/cancellation overlaps, and the existing competing-buyer tests. The full browser run includes buyer, seller, administrator, messaging, reservation, completed exchange, and responsive-layout scenarios.

The build emitted a non-failing plugin-timing diagnostic, and the browser runner emitted colour-setting warnings. These messages are retained in the published output. Development password-reset output is removed from public logs.

The final academic report records the 17 November results. The companion documents also retain the clearly dated 6 November baseline. This record establishes a fresh 18 November check of the published application changes. The report itself was preserved.

The Node.js minimum in setup instructions and package metadata was corrected to 22.12 to match the installed Vite toolchain. No package versions were changed. The checks above ran on Node.js 26.8.1.

Live Google OAuth, SMTP delivery, cloud storage, production deployment, other browser engines, interruption recovery and formal accessibility conformance were outside this run.
