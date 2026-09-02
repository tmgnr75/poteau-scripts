# Read a SOURCE LINE as the running VM currently has it. This is the only
# honest check after a hot reload: kernel_blob.bin on disk is the last FULL
# BUILD and never changes on reload, so grepping it reports stale for code that
# is actually live.
import asyncio, json, sys, websockets
WS, NEEDLE = sys.argv[1], sys.argv[2]

async def main():
    async with websockets.connect(WS, max_size=None) as ws:
        n=[0]
        async def call(m,p=None):
            n[0]+=1
            await ws.send(json.dumps({"jsonrpc":"2.0","id":n[0],"method":m,"params":p or {}}))
            while True:
                r=json.loads(await ws.recv())
                if r.get("id")==n[0]: return r
        vm=await call("getVM"); iso=vm["result"]["isolates"][0]["id"]
        isod=await call("getIsolate",{"isolateId":iso})
        for l in isod["result"]["libraries"]:
            if "package:poteau/" not in l["uri"]:
                continue
            libd=await call("getObject",{"isolateId":iso,"objectId":l["id"]})
            for sc in libd["result"].get("scripts",[]):
                sd=await call("getObject",{"isolateId":iso,"objectId":sc["id"]})
                if NEEDLE in sd["result"].get("source",""):
                    print(f"LIVE: {NEEDLE!r}  ({l['uri'].split('/')[-1]})")
                    return
        print(f"NOT LIVE: {NEEDLE!r} -- the running app does not have this")
asyncio.run(main())
