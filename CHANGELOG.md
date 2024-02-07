# Change Log

All notable changes to the "clang-tidy" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [1.1.0]

- Initial release.
- Use chunks to run clang-tidy.

## [1.1.1]

- Rename the extension to publish.

## [1.1.2]

- Add initial changelog.

## [1.2.0]

- Add usage of default compile_commands when none found in "./build/".
- Make status bare msg more compact.

## [1.3.0]

- Make status bar usage better by adding item, making it compact (and a button).
- Renaming the names to use the new extension name.
- Make diagnostics on files which are closed disappear.

## [2.0.0]

- Change statusbar icon
- Correct statusbar tooltip
- Update the compile_commands stand-in to use C++20 instead of C++17
- Add recursive search for compile_commands
- Save chunk files in $HOME directory instead of cluttering the working directory, as default, but optional
