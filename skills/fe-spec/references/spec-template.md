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
1. **<User action>** → <Expected result>
   - Selector: `[data-testid="..."]` or role-based
2. **<User action>** → <Expected result>
3. ...

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
- Figma node: `<nodeId>`
- Viewport: `<width>x<height>`
- Expected image: `visual-qa/expected/<task>.png`

### Unknowns
- [?] <Questions for the human>
