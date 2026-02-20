# Illumignoti

Swarm-based, anonymized knowledge quiz system.

## Why "Illumignoti" ?!?

The name is a "portmanteau" of "illuminate" / "mignon" ("darling") / "gnosis",
and an intentional play on the word "illuminati". (Because of the global, anonymized nature.)


## World-Wide Quiz Fun

Illumignoti is a platform that allows users to participate in a world-wide trivia "Quiz Show".

All quizes are "short form" and "gameshow style":

- multiple choice (weke)
- Jeopardy style
- fill in the blanks
- true or false
- $10,000 pyramid "explain to someone else without using the words" paraphrasing
- Who Wants to Be a Millionaire

All of the quizes have 'Trivial Pursuit' style categories drawn from a standard 
ontology / controlled vocabulary of knowledge areas. (Dewey decimal system?)

## Implementation Requirements

### Quiz Format

We need to use some standard for encoding "Quizes".

We could make our own custom JSON-Schema, but perhaps there are already standards.

### Programming Language

We will use Golang because of cross-platform functionality.

We will make use of the following libraries (at least):

- Hugo
    - the application will provide a sophisticated and stylish Web UI
    - the web UI will also facilitate user authentication via OpenID
- Charmbracelet
    - log, lipgloss, bubbletea, etc. for engaging and fun CLI support
- cobra
    - for sensible command structure

#### Should we just use Pear? 

Maybe we should just use Pear?

["holepunchto/pear"](https://github.com/holepunchto/pear)