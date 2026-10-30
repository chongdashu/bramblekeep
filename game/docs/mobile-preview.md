# Mobile preview in development

On the development server, use **Mobile view** to open a separate, resizable landscape preview window. Drag on the open game view to move the floating stick and click the on-screen attack and run buttons. Press **Mobile view** again in the original window, or **Close mobile view** in the preview, to close it. A preview opened while playing skips to the game; a preview opened at the menu starts at the menu. Popup blocking must allow the window.

The preview uses a separate guest identity, so joining the shared world does not replace the main window's player. It uses a mobile-sized viewport and mouse input routed through the touch-stick path. It does not emulate browser chrome, device pixel ratios, safe-area insets, performance, or multiple mouse pointers; test multitouch and real-device behavior separately.

The game-neutral `Input.emulateTouch` switch and the matching touch-button visibility hook in the engine are candidates for upstreaming. They default off and are only enabled by the game's dev-only preview.
