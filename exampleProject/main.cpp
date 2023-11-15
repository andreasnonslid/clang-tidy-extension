#include <cstdio.h>

const int BIRTH_YEAR = 1999;
const int CURRENT_YEAR = 2023;

auto mainFixed() -> int {
  for (size_t i = BIRTH_YEAR; i < CURRENT_YEAR; ++i) {
    printf("In %d I was %d years old.", i, i - BIRTH_YEAR);
  }

  return 0;
}

#include <stdio.h>

int main_warnings() {
  for (size_t i = 1999; i < 2023; ++i) {
    printf("In %d I was %d years old.", i, i - 1999);
  }

  return 0;
}
