// Client for tests/svm-bridge (LiteSVM over JSON lines).
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { Keypair, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export class Svm {
  private proc = spawn(here("./svm-bridge/target/release/svm-bridge.exe"), [], { stdio: ["pipe", "pipe", "inherit"] });
  private waiting: ((v: { result?: unknown; error?: string }) => void)[] = [];

  constructor() {
    createInterface({ input: this.proc.stdout }).on("line", (l) => this.waiting.shift()?.(JSON.parse(l)));
  }

  private async call<T>(req: Record<string, unknown>): Promise<T> {
    const p = new Promise<{ result?: unknown; error?: string }>((r) => this.waiting.push(r));
    this.proc.stdin.write(JSON.stringify(req) + "\n");
    const res = await p;
    if (res.error) throw new Error(`svm ${req.op}: ${res.error}`);
    return res.result as T;
  }

  close() {
    this.proc.stdin.end();
  }

  addProgram = (id: PublicKey, path: string) => this.call({ op: "add_program", id: id.toBase58(), path: here(path) });
  airdrop = (pk: PublicKey, lamports: number) => this.call({ op: "airdrop", pubkey: pk.toBase58(), lamports });
  rent = async (size: number) => (await this.call<{ lamports: number }>({ op: "rent", size })).lamports;
  now = async () => BigInt((await this.call<{ unix: number }>({ op: "clock" })).unix);
  setTime = (unix: bigint) => this.call({ op: "set_time", unix: Number(unix) });

  async account(pk: PublicKey): Promise<Uint8Array> {
    const a = await this.call<{ data: string } | null>({ op: "account", pubkey: pk.toBase58() });
    if (!a) throw new Error(`missing account ${pk.toBase58()}`);
    return Uint8Array.from(Buffer.from(a.data, "base64"));
  }

  async send(payer: Keypair, ixs: TransactionInstruction[], signers: Keypair[] = []): Promise<string[]> {
    const tx = new Transaction().add(...ixs);
    tx.recentBlockhash = (await this.call<{ blockhash: string }>({ op: "blockhash" })).blockhash;
    tx.feePayer = payer.publicKey;
    tx.sign(payer, ...signers.filter((s) => !s.publicKey.equals(payer.publicKey)));
    const r = await this.call<{ ok: boolean; err?: string; logs: string[] }>({
      op: "send",
      tx: tx.serialize().toString("base64"),
    });
    if (!r.ok) throw new Error(`tx failed: ${r.err}\n${r.logs.join("\n")}`);
    return r.logs;
  }
}
