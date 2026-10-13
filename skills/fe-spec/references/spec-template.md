# Interaction Spec Template

Use this template when generating specs in PHASE 0 Step 2.
Fill in from Figma design + task description. Mark unknowns with `[?]` and
ask the human for clarification.

---

## Component: <Name>

### Task
<One-line description of what needs to be built or changed>

### Initial State
- [ ] <What the user sees on load>
- [ ] <Default values, disabled states, empty states>

### Interactions
- **IT-1** <User action> → <Expected result>
  - Selector: `[data-testid="..."]` or role-based
- **IT-2** <User action> → <Expected result>
- ...

### State Transitions
- **Loading:** <What shows during async operations>
- **Success:** <What shows after successful action>
- **Error:** <What shows on failure — toast, inline error, etc.>
- **Empty:** <What shows when no data is available>

### Edge Cases
- <Validation errors>
- <Network failure>
- <Unauthorized access>
- <Concurrent actions>

### API Calls
| Endpoint | Method | Mock Response (success) | Mock Response (error) |
|----------|--------|------------------------|-----------------------|
| `/api/...` | POST | `{ ... }` | `{ error: "..." }` |

### Visual Reference
- **VT-1** <label> — Figma node `<nodeId>` (at least one VT item per nodeId)
- Viewport: `<width>x<height>`
- Expected image: `visual-qa/expected/<task>.png`

### Checkpoint Plan (checkpoint mode only)
| CP | Goal | Classification | Test items | VT items | State fixtures | Expected files |
|----|------|----------------|------------|----------|----------------|----------------|
| CP-1 | Report data conversion | logic | IT-1, IT-2 | — | `profile.diagnosisDone` | `toReportSections.ts` |
| CP-2 | Score section (static) | style-only | — | VT-1 | — | `ScoreSection.tsx` |
| CP-3 | Wire sections into page, expand | interactive | IT-3, IT-4 | VT-2 | `profile.diagnosisDone`, `report.toefl.basic` | `DiagnosisReportPage.tsx` |
| CP-4 | Empty and error states | interactive | IT-5, IT-6 | VT-3 | `report.toefl.empty` (new), `report.error500` (new) | same |

### Unknowns
- [?] <Questions for the human>
