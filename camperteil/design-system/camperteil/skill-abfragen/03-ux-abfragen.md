######## error summary validation|ux
## UI Pro Max Search Results
**Domain:** ux | **Query:** error summary validation
**Source:** ux-guidelines.csv | **Found:** 2 results

### Result 1
- **Category:** Forms / Accessibility
- **Issue:** Focusable Error Summary
- **Platform:** Web
- **Description:** An error summary for failed validation complements inline field errors and must be easy to find by keyboard and screen reader users
- **Do:** Place it at the top of the form; move focus to its heading or container after failed submit; link each item to its invalid field; retain inline errors
- **Don't:** Replace inline errors with a visual-only summary or move focus on every blur
- **Code Example Good:** <div role="alert" tabindex="-1" aria-labelledby="error-title"><h2 id="error-title">There is a problem</h2><a href="#email">Enter an email address</a></div>
- **Code Example Bad:** Toast only with no field links or focus target
- **Severity:** High

### Result 2
- **Category:** Accessibility
- **Issue:** Error Messages
- **Platform:** All
- **Description:** Error messages must be announced
- **Do:** Use aria-live or role=alert for errors
- **Don't:** Visual-only error indication
- **Code Example Good:** role='alert'
- **Code Example Bad:** Red border only
- **Severity:** High

######## focus not obscured|ux
## UI Pro Max Search Results
**Domain:** ux | **Query:** focus not obscured
**Source:** ux-guidelines.csv | **Found:** 2 results

### Result 1
- **Category:** Accessibility
- **Issue:** Focus Not Obscured (Enhanced)
- **Platform:** Web
- **Description:** WCAG 2.2 AAA requires keyboard focus to remain fully visible
- **Do:** Keep the entire focused component unobscured by author-created content
- **Don't:** Present this enhanced AAA criterion as an AA requirement or allow persistent UI to hide any part of focus
- **Code Example Good:** close persistent overlay before focus moves behind it
- **Code Example Bad:** sticky footer covers half the focused button
- **Severity:** Medium

### Result 2
- **Category:** Accessibility
- **Issue:** Focus Not Obscured (Minimum)
- **Platform:** Web
- **Description:** WCAG 2.2 AA requires keyboard focus to remain at least partially visible
- **Do:** Offset sticky UI with scroll-padding and dismiss or move persistent overlays
- **Don't:** Let headers footers banners or chat widgets fully cover focus
- **Code Example Good:** scroll-padding-top: var(--header-height)
- **Code Example Bad:** fixed overlay covers :focus
- **Severity:** High

######## video autoplay pause control|ux
## UI Pro Max Search Results
**Domain:** ux | **Query:** video autoplay pause control
**Source:** ux-guidelines.csv | **Found:** 2 results

### Result 1
- **Category:** Sustainability
- **Issue:** Auto-Play Video
- **Platform:** Web
- **Description:** Autoplaying media consumes data and creates motion barriers
- **Do:** Prefer click-to-play; provide pause and captions; stop off-screen and honor reduced motion
- **Don't:** Auto-play high-resolution loops without pause or captions
- **Code Example Good:** <video controls preload="none"><track kind="captions" /></video>
- **Code Example Bad:** autoplay loop
- **Severity:** Medium

### Result 2
- **Category:** Animation
- **Issue:** Auto-Rotating Content Controls
- **Platform:** All
- **Description:** Auto-rotating content needs user control
- **Do:** Provide previous next and play/pause; stop on focus or hover and when reduced motion is requested
- **Don't:** Auto-advance slides without a stop control
- **Code Example Good:** button aria-label="Pause carousel"
- **Code Example Bad:** timer-only carousel
- **Severity:** High

######## reduced motion animation|ux
## UI Pro Max Search Results
**Domain:** ux | **Query:** reduced motion animation
**Source:** ux-guidelines.csv | **Found:** 2 results

### Result 1
- **Category:** Animation
- **Issue:** Reduced Motion
- **Platform:** All
- **Description:** Respect user's motion preferences
- **Do:** Check prefers-reduced-motion media query
- **Don't:** Ignore accessibility motion settings
- **Code Example Good:** @media (prefers-reduced-motion: reduce)
- **Code Example Bad:** No motion query check
- **Severity:** High

### Result 2
- **Category:** Animation
- **Issue:** Excessive Motion
- **Platform:** All
- **Description:** Too many animations cause distraction and motion sickness
- **Do:** Animate 1-2 key elements per view maximum
- **Don't:** Animate everything that moves
- **Code Example Good:** Single hero animation
- **Code Example Bad:** animate-bounce on 5+ elements
- **Severity:** High

######## form step progress back|ux
## UI Pro Max Search Results
**Domain:** ux | **Query:** form step progress back
**Source:** ux-guidelines.csv | **Found:** 2 results

### Result 1
- **Category:** Feedback
- **Issue:** Progress Indicators
- **Platform:** All
- **Description:** Show progress for multi-step processes
- **Do:** Step indicators or progress bar
- **Don't:** No indication of progress
- **Code Example Good:** Step 2 of 4 indicator
- **Code Example Bad:** No step information
- **Severity:** Medium

### Result 2
- **Category:** Navigation
- **Issue:** Back Button
- **Platform:** Mobile
- **Description:** Users expect back to work predictably
- **Do:** Preserve navigation history properly
- **Don't:** Break browser/app back button behavior
- **Code Example Good:** history.pushState()
- **Code Example Bad:** location.replace()
- **Severity:** High

######## sticky cta mobile|ux
## UI Pro Max Search Results
**Domain:** ux | **Query:** sticky cta mobile
**Source:** ux-guidelines.csv | **Found:** 2 results

### Result 1
- **Category:** Navigation
- **Issue:** Sticky Navigation
- **Platform:** Web
- **Description:** Fixed nav should not obscure content
- **Do:** Add padding-top to body equal to nav height
- **Don't:** Let nav overlap first section content
- **Code Example Good:** pt-20 (if nav is h-20)
- **Code Example Bad:** No padding compensation
- **Severity:** Medium

### Result 2
- **Category:** Forms
- **Issue:** Mobile Keyboards
- **Platform:** Mobile
- **Description:** Show appropriate keyboard for input type
- **Do:** Use inputmode attribute
- **Don't:** Default keyboard for all inputs
- **Code Example Good:** inputmode='numeric'
- **Code Example Bad:** Text keyboard for numbers
- **Severity:** Medium

