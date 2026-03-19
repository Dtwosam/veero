import { parseAbi } from "viem";

export const usdcAbi = parseAbi([
  "function balanceOf(address account) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function transfer(address to, uint256 amount) returns (bool)",
]);

export const USDC_CONTRACT = "0x3600000000000000000000000000000000000000" as const;
