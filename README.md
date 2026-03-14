# PowerApp

Frontend for **PowerIndex** --- a demo application for creating and
settling Nordic day‑ahead electricity binary options using an on‑chain
index powered by a Chainlink Runtime Environment (CRE) workflow.

## What It Does

-   Create binary options on Nordic day‑ahead power prices\
-   Monitor on‑chain index commitments\
-   Trigger and fulfill workflow requests (local simulation or CRE)\
-   Settle options automatically based on committed index values

## Market Context

Nord Pool runs the Nordic & Baltic day‑ahead electricity market.

Each day: 
1. Market participants submit bids for the next day (hourly).
2. Nord Pool clears the market around ~12:00--13:00 CET.
3.  Area prices (e.g. NO1, SE3, FI) are published in EUR/MW.

PowerIndex computes a daily average price per area and commits it
on-chain with a verifiable `datasetHash`.

## Architecture

Nord Pool API\
→ CRE Workflow (off-chain compute + consensus)\
→ Forwarder\
→ DailyIndexConsumer (on-chain commitment)\
→ BinaryOption settlement

## Running Locally

Requires: - powerindex repo (contracts + Makefile) - Anvil - Foundry -
Node.js

Typical demo flow:

1.  Start Anvil\
2.  Deploy contracts (`make deploy`)\
3.  Create request (UI or `make request`)\
4.  Simulate workflow (`make simulate-request REQUEST_ID=0`)\
5.  Fulfill + commit (`make fulfill REQUEST_ID=0`)\
6.  Observe settlement in UI

## Networks

Supports: - Local (Anvil) - Sepolia (when CRE + Nord Pool access
available)

Environment variables select consumer, forwarder, and registry per
chain.

PowerApp is a presentation layer, all index logic lives in the `powerindex` repository.
