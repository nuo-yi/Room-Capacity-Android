---
version: alpha
name: UBC Study Spaces
description: Mobile-first design for the UBC study-space website and web app, with live readings from instrumented study spaces.
colors:
  primary: "#235848"
  on-primary: "#FFFFFF"
  canvas: "#F8F9F4"
  surface: "#FFFFFF"
  text: "#203C31"
  muted: "#5E6D56"
  fresh-surface: "#F2F8F4"
  fresh-text: "#4E7062"
  delayed-surface: "#F7F8F2"
  limited-surface: "#FFF6E9"
  limited-text: "#8D5D3F"
typography:
  display:
    fontFamily: "Fraunces Variable, Georgia, serif"
    fontSize: 4.125rem
    fontWeight: 450
    lineHeight: 1.08
    letterSpacing: -2.5px
  mobile-heading:
    fontFamily: "Fraunces Variable, Georgia, serif"
    fontSize: 2rem
    fontWeight: 450
    lineHeight: 1.12
  body:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: 1rem
    fontWeight: 400
    lineHeight: 1.5
  room-title:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: 1rem
    fontWeight: 600
    lineHeight: 1.4
    letterSpacing: -0.3px
  label:
    fontFamily: "DM Sans Variable, sans-serif"
    fontSize: 0.875rem
    fontWeight: 550
    lineHeight: 1.4
rounded:
  badge: 5px
  control: 8px
  card: 13px
  full: 999px
spacing:
  xs: 4px
  sm: 8px
  md: 16px
  card-inset: 20px
  lg: 24px
  xl: 32px
  touch-target: 44px
components:
  page:
    backgroundColor: "{colors.canvas}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.label}"
    rounded: "{rounded.control}"
    padding: "{spacing.md}"
  search-field:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.body}"
    rounded: "{rounded.control}"
    height: "{spacing.touch-target}"
    padding: "{spacing.md}"
  room-card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.text}"
    typography: "{typography.room-title}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-inset}"
  status-fresh:
    backgroundColor: "{colors.fresh-surface}"
    textColor: "{colors.fresh-text}"
    typography: "{typography.label}"
    rounded: "{rounded.badge}"
    padding: "{spacing.xs} {spacing.sm}"
  status-delayed:
    backgroundColor: "{colors.delayed-surface}"
    textColor: "{colors.muted}"
    typography: "{typography.label}"
    rounded: "{rounded.badge}"
    padding: "{spacing.xs} {spacing.sm}"
  status-limited:
    backgroundColor: "{colors.limited-surface}"
    textColor: "{colors.limited-text}"
    typography: "{typography.label}"
    rounded: "{rounded.badge}"
    padding: "{spacing.xs} {spacing.sm}"
---

# UBC Study Spaces — Mobile-first Design System

## Overview

A student should be able to open the site between classes, spot a quiet room with an estimated free seat, and open directions with one hand. The public site gives newcomers a quick explanation and a direct path to the directory. Returning users and shared room links go straight to the relevant app screen. Browsing, comparing, and opening directions require no account, installation, or location permission.

This is a mobile-first variant of the shared design for the public website and web app. The live directory and its features remain available on small and large screens. The mobile layout changes what appears first and how secondary controls are revealed. Keep the shipped product name and existing URLs. Use the existing API, classification logic, and browser-local favourites.

## Colors

Keep the shared pale canvas, white room cards, and forest-green primary actions. Use the fresh, delayed, and limited foreground and background pairs for status labels. Pair each colour with readable text, including when readings are missing or a room is full. Keep noise and seat availability visually distinct so a student can recognize a quiet room with zero estimated seats. Keep focus outlines visible against the adjacent surface.

## Typography

Use Fraunces for headings and DM Sans for interface copy. Use the mobile-heading token for the main title on phones and the display token for the wide website hero. Use at least the body token size for editable fields. Keep card titles, seat estimates, noise labels, and measurement age readable at normal zoom. Let building names, locations, and labels wrap. Use sentence case and short action names such as “Directions,” “Saved,” and “Retry.”

## Layout

Use one column and a single page scroll on phones. At typical phone widths, show a compact header, heading, search, quick filters, and the start of the first room card without a tall hero in the app. Keep site illustration and explanation below the website's primary actions. Use responsive gutters and safe-area insets. At narrow widths or larger text settings, let controls wrap and let content extend naturally below the fold. Preserve the layout at 320 CSS pixels without horizontal page scrolling.

On wider screens, the website can use a two-column hero and the app can use a room grid and inline controls. Keep feature placement recognizable across breakpoints. Keep browser back, deep links, and shareable routes working at every viewport size.

## Elevation & Depth

Use borders and subtle shadows to separate cards. Use an overlay for filters or room details only when that pattern fits the existing routes. Keep the room or filter surface above its backdrop and make its close action visible. A swipe gesture can be supplementary. Always provide a tappable close or back control.

## Shapes

Use the shared control, badge, and card radii. Aim for a 44 CSS pixel minimum touch area for search clear, filter chips, save, back, close, and directions. A compact icon can sit inside a larger hit area. Separate room and save targets so a thumb can activate either without triggering the other.

## Components

### Public website

Use “Find a quiet spot at UBC” above a short explanation. Make “Explore study spaces” the primary mobile action and link it directly to the live directory. Use the existing route when both surfaces share a deployment and a configured app URL when deployed separately. Keep the existing project explanation, illustrative preview, coverage and privacy information, and any existing navigation or footer destinations available on mobile. Label example readings in the preview.

### Directory controls

Use a compact search field labelled “Search by building or room.” Match room names, building names, room numbers, and addresses. Keep the keyboard closed until the student taps search, provide an inline clear action, and keep the query while opening or dismissing room details. Show “Quiet,” “Seats available,” and “Saved” as quick filters. Let the chips wrap. Put building selection and sort in a “Filters and sort” sheet on phones, with an active filter count on the trigger, a visible reset, and an obvious apply action. Preserve existing search, filter, and sort options, including any additional ones in the target repo.

Default to rooms with fresh readings first. Keep uninstrumented directory entries browsable. When sorting by seat estimate, put unknowns after known values and treat zero as a known value. Show coverage separately from the filtered result count. If nothing matches, keep the query and filters visible and provide a clear recovery action. Saved spaces use the existing browser-local store and remain available even when their readings are absent.

### Room cards and details

Show room name and location first, then noise, estimated seats or people count, and measurement age. A card might say “Quiet,” “About 12 seats free,” and “Measured 8 seconds ago.” Use the card's room link or button to open details and a separate labelled save control. Make optional illustrations secondary to the room metrics.

On a phone, open details in a single-column screen or full-height sheet with one scrolling region. Put the room name, location, current readings, and “Directions” near the top. Show directions when there is a usable address or coordinates, and preserve the separate official UBC room link. Keep “Recent occupancy” below the immediate actions. Use measured times and people counts on the axes, plot zero, and provide the latest count and its time as text. A chart failure should leave directions and room information usable.

When students return from details, restore the query, filters, sort, and approximate list position. If details are modal, support Escape, trap focus, and return it to the trigger. Keep browser Back predictable and support existing room deep links.

## Do's and Don'ts

Keep the first decision close to the top of the phone screen. Load directory controls and useful room information before optional images and charts. Keep the list steady during polling so a refresh cannot shift a target under a user's thumb. Update readings in place where possible. Respect reduced motion and announce meaningful errors without announcing every refresh.

Avoid blocking the directory behind a sign-in, permission prompt, onboarding screen, or automatically opened keyboard. Avoid hiding features behind hover or swipe. Keep actions above safe-area insets and clear of any sticky chrome. Keep current, stale, and missing readings distinguishable without relying on colour.

## Live readings and recovery

Use the backend freshness threshold and measure age from the sensor's timestamp. A successful check is separate from a recent reading. Keep prior results on a failed refresh and show a small connection message while readings continue to age. A stale value should lose its current noise and seat claims and show its last measured time. A space with no reading remains browsable. A fresh zero count is valid. When capacity is known, estimated seats equal capacity minus people count, floored at zero. With unknown capacity, show the fresh people count when available. Only use dBA when the source reports that unit.

Keep first load, first-request failure, empty directory, no filter matches, missing reading, and stale reading distinct. On first-request failure, show “Couldn't load study spaces” with a “Retry” action. When only the chart fails, keep the recovery inside the chart area. Keep the live coverage denominator based on the full live directory before filters.

## Live device in an existing study space

The mobile website and app open the live directory. Remove the demo entry, exit control, and sample-data fallback from the mobile experience. If an older demo link is opened on a phone, take the visitor to the live directory. Any existing desktop demo is outside the scope of this mobile spec.

Choose an existing study space from the directory and register or assign the device to that space's existing room ID using the app's device setup. Use a measurement from the actual study spot. The device sends authenticated readings to `POST /api/readings` using the existing API contract, with measurement timestamps and units for the reported metrics. Keep the device credential on the device. Reuse the directory record, including its official link and listed capacity where available.

The API accepts and stores the reading. The mobile app reads it through the existing directory and room data endpoints and updates the matching card and open details through the existing refresh flow. The phone only needs a browser. Leave spaces without a sensor in the directory with “No live readings.” A sensor that stops posting follows the same stale-reading behavior as any other live space.

## Feature parity and acceptance

Before implementing, inventory the routes, controls, content, and feature flags in both target repos. Preserve the public site's existing content and navigation, and preserve the app's existing directory, search, filters, sorting, saved rooms, live statuses, coverage, room details, history, official links, and directions. Move secondary features into a labelled control when necessary. Use the same live-directory functional tests for mobile and desktop wherever possible.

Verify the primary website links on 320, 375, and 430 CSS pixel viewports and at a representative desktop width. Test opening a room, following directions, and returning to the same list state. Test narrow filter wrapping, visible focus, increased text size, reduced motion, and a mobile keyboard that does not obscure the active field. Test zero counts, stale transitions, a failed refresh, unknown capacity, and an empty result set. Verify that a phone follows the public site's primary action into the live directory and that an old demo link resolves to the live directory on mobile. With an authorized device assigned to an existing study space, post an actual reading, confirm it appears on the corresponding card and open room detail view, and check that the room contributes once to live coverage. Stop posting and confirm the reading ages into the stale state. Check that rooms without a device remain browsable. Run the app's existing build and browser checks and Google's `designmd lint` on the design file.
