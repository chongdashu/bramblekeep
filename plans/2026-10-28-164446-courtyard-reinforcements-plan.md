# Courtyard Reinforcements Plan

Linked prompts file: `prompts/2026-10-28-164446-courtyard-reinforcements-prompts.md`
Linked learnings file: `learnings/2026-10-28-164446-courtyard-reinforcements-learnings.md`

## Goal

Keep a bounded stream of defenders appearing in the boss courtyard after breach.

## Approach

Reserve two interior slots separate from the six exterior patrol slots, use the existing barracks doors, stagger replenishment, skip occupied doors and maintain defense while a player remains inside.

## Verification

Run the isolated build, full simulation tests and a two-client browser breach with assertions for both interior defenders.
