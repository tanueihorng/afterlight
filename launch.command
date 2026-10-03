#!/bin/sh
# Double-click twin of launch.sh: Finder runs this in Terminal, which then
# hands off to the same logic (deps, BROWSER fix, vite --open).
exec "$(dirname "$0")/launch.sh"
