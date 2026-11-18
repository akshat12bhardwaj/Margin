| ID | Activity | Predecessors | O | M | P | tₑ = (O+4M+P)/6 | Variance ((P−O)/6)² |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | Requirements elicitation and handout analysis | – | 2 | 3 | 5 | 3.17 | 0.25 |
| B | System, database and UI design | A | 2 | 4 | 6 | 4.00 | 0.44 |
| C | Backend foundation and authentication (incl. Google) | B | 3 | 5 | 8 | 5.17 | 0.69 |
| D | Listings, photos, search, filters and subject catalogue | C | 4 | 6 | 9 | 6.17 | 0.69 |
| E | Purchase requests, negotiation, messaging, notifications | D | 5 | 7 | 11 | 7.33 | 1.00 |
| F | Reporting, moderation, admin dashboard, audit log | C | 3 | 5 | 7 | 5.00 | 0.44 |
| G | Frontend pages, responsive layout, themes | C | 6 | 9 | 13 | 9.17 | 1.36 |
| H | Example marketplace data and automated sellers | E | 3 | 4 | 7 | 4.33 | 0.44 |
| I | Integration, system and regression testing | E, F, G, H | 3 | 5 | 8 | 5.17 | 0.69 |
| J | Project documentation (SRS, design, test report) | I | 3 | 4 | 6 | 4.17 | 0.25 |
| K | Evaluation readiness: build, setup checks, demo data | I, J | 1 | 2 | 3 | 2.00 | 0.11 |

| ID | Duration | ES | EF | LS | LF | Slack | Critical |
| --- | --- | --- | --- | --- | --- | --- | --- |
| A | 3.17 | 0.00 | 3.17 | 0.00 | 3.17 | 0.00 | Yes |
| B | 4.00 | 3.17 | 7.17 | 3.17 | 7.17 | 0.00 | Yes |
| C | 5.17 | 7.17 | 12.34 | 7.17 | 12.34 | 0.00 | Yes |
| D | 6.17 | 12.34 | 18.51 | 12.34 | 18.51 | 0.00 | Yes |
| E | 7.33 | 18.51 | 25.84 | 18.51 | 25.84 | 0.00 | Yes |
| F | 5.00 | 12.34 | 17.34 | 25.17 | 30.17 | 12.83 | No |
| G | 9.17 | 12.34 | 21.51 | 21.00 | 30.17 | 8.66 | No |
| H | 4.33 | 25.84 | 30.17 | 25.84 | 30.17 | 0.00 | Yes |
| I | 5.17 | 30.17 | 35.34 | 30.17 | 35.34 | 0.00 | Yes |
| J | 4.17 | 35.34 | 39.51 | 35.34 | 39.51 | 0.00 | Yes |
| K | 2.00 | 39.51 | 41.51 | 39.51 | 41.51 | 0.00 | Yes |

Critical path: A → B → C → D → E → H → I → J → K
Expected project duration: 41.51 working days; standard deviation along the critical path: 2.14 days
P(finish within 40 days) ≈ 24.0%
P(finish within 42 days) ≈ 59.1%
P(finish within 44 days) ≈ 87.8%
Total estimated effort (sum of durations): 55.68 developer-days

Basic COCOMO (organic), 6.39 KLOC: effort 16.8 person-months, schedule 7.3 months, average staff 2.3
