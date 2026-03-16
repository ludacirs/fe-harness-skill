# Figma MCP Reference

Used in PHASE 0 to extract expected images from Figma designs.

## Finding the nodeId

From a Figma URL:
```
https://www.figma.com/file/<FILE_KEY>/...?node-id=123-456
```
- `node-id=123-456` → API nodeId: `123:456`
- `node-id=123%3A456` → API nodeId: `123:456`

To browse available frames:
```js
mcp__figma__get_file({ fileKey: "YOUR_FILE_KEY" })
// → inspect document.children for frame id and name
```

## Extracting expected.png

```js
mcp__figma__get_images({
  fileKey: "YOUR_FILE_KEY",
  ids: ["123:456"],
  format: "png",
  scale: 2,             // 2x for retina; match to your dev viewport
})
// → { images: { "123:456": "https://..." } }
```

Fetch the returned URL and save to `visual-qa/expected/<task-name>.png`.

## Matching viewport dimensions

Always match the Figma frame size to capture.ts's viewport:

```js
mcp__figma__get_file({ fileKey: "..." })
// → document.children[N].absoluteBoundingBox: { width, height }
```

Pass those values as --width/--height when running capture.ts.

## Common calls

| Situation | Call |
|-----------|------|
| Browse file structure | `get_file` |
| Export frame as image | `get_images` with nodeId |
| Check component variants | `get_file` → componentSets |
| Inspect design tokens | `get_file_styles` |
