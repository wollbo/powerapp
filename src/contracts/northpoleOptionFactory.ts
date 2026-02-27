export const northpoleOptionFactoryAbi = [
  // ========= Events =========
  {
    type: "event",
    name: "OptionCreated",
    anonymous: false,
    inputs: [
      { indexed: true, name: "option", type: "address" },
      { indexed: true, name: "consumer", type: "address" },
      { indexed: true, name: "seller", type: "address" },
      { indexed: false, name: "indexId", type: "bytes32" },
      { indexed: false, name: "areaId", type: "bytes32" },
      { indexed: false, name: "yyyymmdd", type: "uint32" },
      { indexed: false, name: "strike1e6", type: "int256" },
      { indexed: false, name: "direction", type: "uint8" },
      { indexed: false, name: "premiumWei", type: "uint256" },
      { indexed: false, name: "payoutWei", type: "uint256" },
      { indexed: false, name: "buyDeadline", type: "uint64" },
    ],
  },

  // ========= Errors =========
  { type: "error", name: "InvalidValue", inputs: [] },
  { type: "error", name: "IndexAlreadyPublished", inputs: [] },

  // ========= Functions =========
  {
    type: "function",
    name: "createOption",
    stateMutability: "payable",
    inputs: [
      { name: "consumer", type: "address" },
      { name: "indexId", type: "bytes32" },
      { name: "areaId", type: "bytes32" },
      { name: "yyyymmdd", type: "uint32" },
      { name: "strike1e6", type: "int256" },
      { name: "direction", type: "uint8" }, // 0/1
      { name: "premiumWei", type: "uint256" },
      { name: "buyDeadline", type: "uint64" },
    ],
    outputs: [{ name: "option", type: "address" }],
  },
] as const;
