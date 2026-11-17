// IDL-driven borsh codec for the Kondora program. Covers exactly the types the
// program uses: integers, f64, bool, pubkey, fixed arrays, defined structs.
// u64/i64 are bigint, f64 is number, pubkey is PublicKey, fields keep IDL names.

import { PublicKey } from "@solana/web3.js";
import idlJson from "./idl.json";

// JSON default import differs between ESM and CJS loaders.
const idl = ((idlJson as unknown as { default?: typeof idlJson }).default ?? idlJson) as typeof idlJson;

type IdlType =
  | string
  | { array: [IdlType, number] }
  | { defined: { name: string } }
  | { option: IdlType };

interface IdlField {
  name: string;
  type: IdlType;
}

const TYPES = new Map<string, IdlField[]>(
  (idl.types as { name: string; type: { fields?: IdlField[] } }[]).map((t) => [t.name, t.type.fields ?? []]),
);

const SIZES: Record<string, number> = {
  u8: 1, i8: 1, bool: 1, u16: 2, i16: 2, u32: 4, i32: 4, f32: 4, u64: 8, i64: 8, f64: 8, pubkey: 32,
};

export function sizeOf(t: IdlType): number {
  if (typeof t === "string") {
    const s = SIZES[t];
    if (s === undefined) throw new Error(`unsupported type ${t}`);
    return s;
  }
  if ("array" in t) return sizeOf(t.array[0]) * t.array[1];
  if ("defined" in t) return fieldsOf(t.defined.name).reduce((n, f) => n + sizeOf(f.type), 0);
  throw new Error("options are variable size");
}

function fieldsOf(name: string): IdlField[] {
  const f = TYPES.get(name);
  if (!f) throw new Error(`unknown type ${name}`);
  return f;
}

export class Writer {
  private buf = new Uint8Array(256);
  private view = new DataView(this.buf.buffer);
  len = 0;

  private ensure(n: number) {
    if (this.len + n <= this.buf.length) return;
    const next = new Uint8Array(Math.max(this.buf.length * 2, this.len + n));
    next.set(this.buf);
    this.buf = next;
    this.view = new DataView(next.buffer);
  }

  bytes(b: Uint8Array) {
    this.ensure(b.length);
    this.buf.set(b, this.len);
    this.len += b.length;
  }

  write(t: IdlType, v: unknown) {
    if (typeof t === "string") return this.prim(t, v);
    if ("array" in t) {
      const arr = v as ArrayLike<unknown>;
      if (arr.length !== t.array[1]) throw new Error(`array length ${arr.length} != ${t.array[1]}`);
      for (let i = 0; i < arr.length; i++) this.write(t.array[0], arr[i]);
      return;
    }
    if ("defined" in t) {
      const obj = v as Record<string, unknown>;
      for (const f of fieldsOf(t.defined.name)) {
        if (!(f.name in obj)) throw new Error(`missing field ${f.name}`);
        this.write(f.type, obj[f.name]);
      }
      return;
    }
    if (v === null || v === undefined) return this.prim("u8", 0);
    this.prim("u8", 1);
    this.write(t.option, v);
  }

  private prim(t: string, v: unknown) {
    this.ensure(SIZES[t] ?? 0);
    const o = this.len;
    switch (t) {
      case "u8": this.view.setUint8(o, Number(v)); break;
      case "i8": this.view.setInt8(o, Number(v)); break;
      case "bool": this.view.setUint8(o, v ? 1 : 0); break;
      case "u16": this.view.setUint16(o, Number(v), true); break;
      case "i16": this.view.setInt16(o, Number(v), true); break;
      case "u32": this.view.setUint32(o, Number(v), true); break;
      case "i32": this.view.setInt32(o, Number(v), true); break;
      case "f32": this.view.setFloat32(o, Number(v), true); break;
      case "u64": this.view.setBigUint64(o, BigInt(v as bigint), true); break;
      case "i64": this.view.setBigInt64(o, BigInt(v as bigint), true); break;
      case "f64": this.view.setFloat64(o, Number(v), true); break;
      case "pubkey": {
        const pk = v instanceof PublicKey ? v : new PublicKey(v as string);
        this.buf.set(pk.toBytes(), o);
        break;
      }
      default: throw new Error(`unsupported type ${t}`);
    }
    this.len += SIZES[t];
  }

  finish(): Uint8Array {
    return this.buf.slice(0, this.len);
  }
}

export class Reader {
  private view: DataView;
  off: number;

  constructor(private data: Uint8Array, off = 0) {
    this.view = new DataView(data.buffer, data.byteOffset, data.byteLength);
    this.off = off;
  }

  read(t: IdlType): unknown {
    if (typeof t === "string") return this.prim(t);
    if ("array" in t) {
      if (t.array[0] === "u8") {
        const out = this.data.slice(this.off, this.off + t.array[1]);
        this.off += t.array[1];
        return out;
      }
      return Array.from({ length: t.array[1] }, () => this.read(t.array[0]));
    }
    if ("defined" in t) {
      const obj: Record<string, unknown> = {};
      for (const f of fieldsOf(t.defined.name)) obj[f.name] = this.read(f.type);
      return obj;
    }
    return this.prim("u8") === 1 ? this.read(t.option) : null;
  }

  private prim(t: string): unknown {
    const o = this.off;
    this.off += SIZES[t];
    switch (t) {
      case "u8": return this.view.getUint8(o);
      case "i8": return this.view.getInt8(o);
      case "bool": return this.view.getUint8(o) !== 0;
      case "u16": return this.view.getUint16(o, true);
      case "i16": return this.view.getInt16(o, true);
      case "u32": return this.view.getUint32(o, true);
      case "i32": return this.view.getInt32(o, true);
      case "f32": return this.view.getFloat32(o, true);
      case "u64": return this.view.getBigUint64(o, true);
      case "i64": return this.view.getBigInt64(o, true);
      case "f64": return this.view.getFloat64(o, true);
      case "pubkey": return new PublicKey(this.data.slice(o, o + 32));
      default: throw new Error(`unsupported type ${t}`);
    }
  }
}

export function encodeArgs(ixName: string, args: Record<string, unknown>): Uint8Array {
  const ix = (idl.instructions as { name: string; discriminator: number[]; args: IdlField[] }[]).find(
    (i) => i.name === ixName,
  );
  if (!ix) throw new Error(`unknown instruction ${ixName}`);
  const w = new Writer();
  w.bytes(Uint8Array.from(ix.discriminator));
  for (const a of ix.args) {
    if (!(a.name in args)) throw new Error(`${ixName}: missing arg ${a.name}`);
    w.write(a.type, args[a.name]);
  }
  return w.finish();
}

function discriminatorOf(kind: "accounts" | "events", name: string): number[] {
  const list = idl[kind] as { name: string; discriminator: number[] }[];
  const d = list.find((x) => x.name === name)?.discriminator;
  if (!d) throw new Error(`unknown ${kind} ${name}`);
  return d;
}

function hasPrefix(data: Uint8Array, d: number[]): boolean {
  return d.every((b, i) => data[i] === b);
}

export function decodeAccount<T>(name: string, data: Uint8Array): T {
  if (!hasPrefix(data, discriminatorOf("accounts", name))) throw new Error(`not a ${name} account`);
  return new Reader(data, 8).read({ defined: { name } }) as T;
}

export function accountDiscriminator(name: string): Uint8Array {
  return Uint8Array.from(discriminatorOf("accounts", name));
}

const EVENT_NAMES = (idl.events as { name: string }[]).map((e) => e.name);

export function decodeEvent(data: Uint8Array): { name: string; data: Record<string, unknown> } | null {
  for (const name of EVENT_NAMES) {
    if (hasPrefix(data, discriminatorOf("events", name))) {
      return { name, data: new Reader(data, 8).read({ defined: { name } }) as Record<string, unknown> };
    }
  }
  return null;
}

/**
 * Parses `Program data: <base64>` lines emitted by `emit!`, only while the
 * Kondora program itself is executing (tracked through the invoke stack), so
 * another program cannot forge events into the feed.
 */
export function eventsFromLogs(logs: string[], programId: string = idl.address): { name: string; data: Record<string, unknown> }[] {
  const out: { name: string; data: Record<string, unknown> }[] = [];
  const stack: string[] = [];
  for (const line of logs) {
    const inv = line.match(/^Program (\w+) invoke \[\d+\]$/);
    if (inv) {
      stack.push(inv[1]);
      continue;
    }
    if (/^Program \w+ (success|failed)/.test(line)) {
      stack.pop();
      continue;
    }
    const m = line.match(/^Program data: (.+)$/);
    if (!m || stack[stack.length - 1] !== programId) continue;
    const bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
    const ev = decodeEvent(bytes);
    if (ev) out.push(ev);
  }
  return out;
}
