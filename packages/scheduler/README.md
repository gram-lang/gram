# @gram-lang/scheduler

*Part of the [Gram monorepo](https://git.gram-lang.org/gram-lang/gram).*

The scheduling engine behind Gram recipes. It lays tasks out on a timeline (as-late-as-possible backward pass, named-track contention, mise en place placement, working-day sessions) from a neutral description of the work, and knows nothing about the Gram AST or the compiled recipe: `@gram-lang/kitchen` feeds it and writes the result into the compiled JSON.

This package is an internal building block for now; its API grows with the 1.4 planning work.
