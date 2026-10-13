# Asset sources

The website keeps a self-contained snapshot of approved Ambute runtime assets.
The source game repository is never modified by the website build.

Snapshot date: 2026-10-13

| Website asset | Read-only source | SHA-256 |
| --- | --- | --- |
| `public/assets/game/characters/Popi_LabPreview.glb` | `C:\Github\Github\Apps\ambute\artifacts\blender\ambute-character\runtime\Popi_LabPreview.glb` | `915F1DAB8A9CD3EC66D1632DCB43E26706ACB27F6992653F1A1230002ABBE4F7` |
| `public/assets/game/world/ambute-painted-tree.glb` | `C:\Github\Github\Apps\ambute\public\models\ambute-painted-tree.glb` | `C486336973E3418E97E39C3DC267D84107798980D1DA7C94BB45BB93EC2288C0` |
| `public/assets/game/world/ambute-painted-leaf-atlas-watercolor-v3.png` | `C:\Github\Github\Apps\ambute\public\textures\ambute-painted-leaf-atlas-watercolor-v3.png` | `39FBC310CB519F293096EA869873FB30BDD9E10E4E0BA7CDFDF14C172F6225B8` |

The website's isolated scene modules adapt the game's current implementations
from these read-only sources:

- Grass blade geometry, `#5d733b` lawn palette, and wind motion:
  `C:\Github\Github\Apps\ambute\src\three\instancedGrass.js`
- Painted leaf-card preparation and camera-facing billboard expansion:
  `C:\Github\Github\Apps\ambute\src\three\paintedTreeCanopy.js`
- Painted cloud geometry and vertex-color treatment:
  `C:\Github\Github\Apps\ambute\src\three\paintedCloud.js`

`public/assets/brand/steam-logo-white.png` is a transparent monochrome treatment
derived from the approved logo artwork in Valve's
[Steam branding documentation](https://partner.steamgames.com/doc/marketing/branding).
Its SHA-256 is
`0A306857B61D97230108EA3ABAAF37C6894ADB489F1030770B48A38994668B53`.

`public/assets/scene/ambute-island-poster.webp` was captured from the completed
website scene at 1440 × 900 for the WebGL fallback and social preview. Its
SHA-256 is
`103761F9C9352CD19EE8A285C5DF534323BE533BBCD6DAB4565B9C4B9A0E622D`.
