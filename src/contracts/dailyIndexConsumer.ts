export const dailyIndexConsumerAbi = [
  {
    type: "event",
    name: "DailyIndexCommitted",
    inputs: [
      { indexed: true, name: "indexId", type: "bytes32" },
      { indexed: true, name: "areaId", type: "bytes32" },
      { indexed: true, name: "yyyymmdd", type: "uint32" },
      { indexed: false, name: "value1e6", type: "int256" },
      { indexed: false, name: "datasetHash", type: "bytes32" },
      { indexed: false, name: "reporter", type: "address" },
      { indexed: false, name: "reportedAt", type: "uint64" },
    ],
    anonymous: false,
  },
  {
    type: "function",
    name: "commitments",
    stateMutability: "view",
    inputs: [
      { name: "indexId", type: "bytes32" },
      { name: "areaId", type: "bytes32" },
      { name: "yyyymmdd", type: "uint32" },
    ],
    outputs: [
      { name: "datasetHash", type: "bytes32" },
      { name: "value1e6", type: "int256" },
      { name: "reporter", type: "address" },
      { name: "reportedAt", type: "uint64" },
    ],
  },
] as const;
