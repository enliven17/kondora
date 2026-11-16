use std::io::{self, BufRead, Write};

use base64::{engine::general_purpose::STANDARD as B64, Engine};
use litesvm::LiteSVM;
use serde_json::{json, Value};
use solana_address::Address;
use solana_clock::Clock;
use solana_transaction::Transaction;

fn addr(v: &Value, k: &str) -> Result<Address, String> {
    v[k].as_str().ok_or(format!("missing {k}"))?.parse().map_err(|e| format!("{k}: {e:?}"))
}

fn handle(svm: &mut LiteSVM, req: &Value) -> Result<Value, String> {
    match req["op"].as_str().unwrap_or("") {
        "add_program" => {
            let bytes = std::fs::read(req["path"].as_str().ok_or("path")?).map_err(|e| e.to_string())?;
            svm.add_program(addr(req, "id")?, &bytes).map_err(|e| format!("{e:?}"))?;
            Ok(json!({}))
        }
        "airdrop" => {
            svm.airdrop(&addr(req, "pubkey")?, req["lamports"].as_u64().ok_or("lamports")?)
                .map_err(|e| format!("{e:?}"))?;
            Ok(json!({}))
        }
        "blockhash" => Ok(json!({ "blockhash": svm.latest_blockhash().to_string() })),
        "rent" => Ok(json!({ "lamports": svm.minimum_balance_for_rent_exemption(req["size"].as_u64().ok_or("size")? as usize) })),
        "send" => {
            let raw = B64.decode(req["tx"].as_str().ok_or("tx")?).map_err(|e| e.to_string())?;
            let tx: Transaction = bincode::deserialize(&raw).map_err(|e| e.to_string())?;
            let res = svm.send_transaction(tx);
            svm.expire_blockhash();
            Ok(match res {
                Ok(m) => json!({ "ok": true, "logs": m.logs, "cu": m.compute_units_consumed }),
                Err(f) => json!({ "ok": false, "err": format!("{:?}", f.err), "logs": f.meta.logs }),
            })
        }
        "account" => Ok(match svm.get_account(&addr(req, "pubkey")?) {
            Some(a) => json!({ "data": B64.encode(&a.data), "owner": a.owner.to_string(), "lamports": a.lamports }),
            None => Value::Null,
        }),
        "clock" => {
            let c = svm.get_sysvar::<Clock>();
            Ok(json!({ "unix": c.unix_timestamp, "slot": c.slot }))
        }
        "set_time" => {
            let mut c = svm.get_sysvar::<Clock>();
            c.unix_timestamp = req["unix"].as_i64().ok_or("unix")?;
            c.slot += 1;
            svm.set_sysvar::<Clock>(&c);
            Ok(json!({}))
        }
        op => Err(format!("unknown op {op}")),
    }
}

fn main() {
    let mut svm = LiteSVM::new();
    let stdin = io::stdin();
    let mut out = io::stdout().lock();
    for line in stdin.lock().lines() {
        let Ok(line) = line else { break };
        let resp = match serde_json::from_str::<Value>(&line) {
            Ok(req) => match handle(&mut svm, &req) {
                Ok(v) => json!({ "result": v }),
                Err(e) => json!({ "error": e }),
            },
            Err(e) => json!({ "error": e.to_string() }),
        };
        writeln!(out, "{resp}").ok();
        out.flush().ok();
    }
}
