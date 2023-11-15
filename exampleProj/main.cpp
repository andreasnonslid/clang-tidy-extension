#include <cstdio.h>

const int BIRTH_YEAR = 1999;
const int CURRENT_YEAR = 2023;

auto main() -> int {
    for (size_t i = BIRTH_YEAR; i < CURRENT_YEAR; ++i)
    {
        printf("In %d I was %d years old.", i, i - BIRTH_YEAR);
    }

    return 0;
}
