import { defineConfig } from 'vite';

// Relative paths in the built page, so it works wherever it is served from: the root of a site, or a
// sub-folder such as https://<user>.github.io/everpainting-spire/ on GitHub Pages.
export default defineConfig({ base: './' });
