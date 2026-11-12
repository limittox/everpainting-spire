# The Everpainting Spire

A calm, painterly wander across five floating islands. Walk, skate and glide through a world that is still wet, paint it with your brush, wake what sleeps along the way, and lay the last stroke on the Spire yourself.

**[Play it in your browser](https://limittox.github.io/everpainting-spire/)**

![Lantern Rise, with the Spire in the distance](docs/screenshot.jpg)

There is no combat and nothing to fail. If you fall, the paint carries you back.

## Controls

| Key | What it does |
|---|---|
| `W` `A` `S` `D` | Walk |
| Mouse | Look around (arrow keys also work) |
| `Shift` | Skate |
| `Space` | Jump; press again in the air to jump once more; hold in the air to glide |
| Click, or `J` / `F` | Swing the brush: it paints the ground and whatever stands nearby |
| `Q`, right-click, or `1`–`0` | Change paint |
| `E` | Hold to paint a sketched bridge; press to rest at an easel or step through a door |
| `G` | Sketchbook: your paintings and everything you have found |
| `C` | Photo mode |
| `H` | Map |
| `M` | Sound on or off |
| `P` | Cycle the brushwork filter |
| `Esc` | Settings |

## What there is to do

- **Paint.** Every swing lays real strokes into the ground and soaks colour into trees, rocks and walls. Flowers come up where you walk.
- **Follow the route.** Paint the sketched bridges, gather three sparks of inspiration, and reach the Spire.
- **Rest.** Sit at an easel and the painter paints the view in front of it. Each finished picture is yours to save.
- **Look around.** There are sleeping companions to wake, sketches waiting to be painted into being, springs that colour their waterfalls, and a few places no path leads to.
- **Keep going.** The ending opens more of the world, and a second journey lets you start again with what you earned.

The journey is saved in your browser as you play.

## Running it yourself

You need [Node.js](https://nodejs.org/) 18 or newer.

```bash
npm install
```

```bash
npm run dev
```

Then open http://localhost:5183.

To make a production build in `dist/`:

```bash
npm run build
```

Pushing to `main` builds and publishes the game to GitHub Pages (see `.github/workflows/pages.yml`).

## How it is made

The game is written in plain JavaScript with [three.js](https://threejs.org/) and built with [Vite](https://vitejs.dev/). It has no art or sound files:

- **The world** is generated in code: geometry coloured stroke by stroke, and island ground painted onto canvases with thousands of brush strokes.
- **The painterly look** is a post-process: a Kuwahara filter smears each frame like a palette knife, then a relief pass lights the paint as if it were thick.
- **The music and sounds** are synthesised with the Web Audio API. The music gains layers as you progress.

### Source layout

| File | What is in it |
|---|---|
| `src/main.js` | The game loop, rules, camera, menus, saving and restoring |
| `src/world.js` | Islands, bridges, the Spire, sky, sea, clouds and winds |
| `src/player.js`, `src/painter.js` | The painter: movement, animation, and the model with its cloth cape |
| `src/post.js` | The painterly post-process |
| `src/paint.js` | Brush strokes on the ground and colour soaked into objects |
| `src/bloom.js` | Flowers, buds and blossom that follow the painter |
| `src/vista.js` | Easels and the pictures painted at them |
| `src/entities.js` | Particles, sparks and companions |
| `src/sketches.js`, `src/setpieces.js`, `src/secrets.js` | Sketches, the island set-pieces and the hidden places |
| `src/interior.js`, `src/sights.js` | Inside the Spire, and the far-off sights |
| `src/day.js`, `src/audio.js` | Time of day; music and sound |
| `src/hud.js`, `src/settings.js`, `src/save.js` | On-screen prompts and map, the settings panel, and storage |
| `src/util.js` | Shared helpers: palettes, noise, stroke geometry |

## Licence

[MIT](LICENSE)
