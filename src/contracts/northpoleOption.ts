export const northpoleOptionAbi = [
  // ========= Events =========
  {
    type: "event",
    name: "Purchased",
    anonymous: false,
    inputs: [{ indexed: true, name: "buyer", type: "address" }],
  },
  {
    type: "event",
    name: "CancelledBySeller",
    anonymous: false,
    inputs: [],
  },
  {
    type: "event",
    name: "Settled",
    anonymous: false,
    inputs: [
      { indexed: true, name: "winner", type: "address" },
      { indexed: false, name: "indexValue1e6", type: "int256" },
      { indexed: false, name: "datasetHash", type: "bytes32" },
      { indexed: false, name: "payoutWei", type: "uint256" },
    ],
  },

  // ========= Errors =========
  { type: "error", name: "AlreadyPurchased", inputs: [] },
  { type: "error", name: "Cancelled", inputs: [] },
  { type: "error", name: "AlreadySettled", inputs: [] },
  { type: "error", name: "NotSeller", inputs: [] },
  { type: "error", name: "InvalidValue", inputs: [] },
  { type: "error", name: "NotAllowed", inputs: [] },
  { type: "error", name: "BuyClosed", inputs: [] },
  { type: "error", name: "IndexNotAvailable", inputs: [] },
  { type: "error", name: "IndexAlreadyPublished", inputs: [] },

  // ========= Read (public immutable/public vars generate getters) =========
  { type: "function", name: "consumer", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "seller", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },

  { type: "function", name: "indexId", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bytes32" }] },
  { type: "function", name: "areaId", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bytes32" }] },
  { type: "function", name: "yyyymmdd", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint32" }] },
  { type: "function", name: "strike1e6", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "int256" }] },

  // enum getter returns uint8
  { type: "function", name: "direction", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint8" }] },

  { type: "function", name: "premiumWei", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "payoutWei", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { type: "function", name: "buyDeadline", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint64" }] },

  { type: "function", name: "buyer", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "address" }] },
  { type: "function", name: "cancelled", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },
  { type: "function", name: "settled", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "bool" }] },

  // ========= Write =========
  { type: "function", name: "cancel", stateMutability: "nonpayable", inputs: [], outputs: [] },
  { type: "function", name: "buy", stateMutability: "payable", inputs: [], outputs: [] },
  { type: "function", name: "settle", stateMutability: "nonpayable", inputs: [], outputs: [] },
] as const;
