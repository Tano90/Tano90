window.__fake={orgs:[{id:'org-1',name:'DURON Testbetrieb'}],memberships:[{organization_id:'org-1',user_id:'user-1',role:'owner'}],snapshots:{'org-1':{data:{},revision:0}},user:{id:'user-1',email:'demo@example.com'},saveCount:0};
window.supabase={createClient:()=>({
 auth:{getSession:async()=>({data:{session:{user:window.__fake.user}},error:null}),onAuthStateChange:()=>({data:{subscription:{unsubscribe(){}}}}),signInWithPassword:async()=>({data:{session:{user:window.__fake.user}},error:null}),signOut:async()=>({error:null})},
 rpc:async(name,args={})=>{const f=window.__fake;
 if(name==='glb_accept_invitations')return{data:0,error:null};
 if(name==='glb_read_workspace')return{data:{...f.snapshots[args.p_org],role:f.memberships[0].role},error:null};
 if(name==='glb_save_snapshot'||name==='glb_save_limited'){const old=f.snapshots[args.p_org];if(old.revision!==args.p_expected_revision)return{error:{message:'REVISION_CONFLICT'}};old.data=args.p_data;old.revision++;f.saveCount++;return{data:old.revision,error:null};}
 if(name==='glb_list_members')return{data:[{user_id:f.user.id,email:f.user.email,role:f.memberships[0].role}],error:null};
 return{data:null,error:null};},
 from:(table)=>({select:()=>({eq:()=>Promise.resolve({data:window.__fake.memberships,error:null}),in:(k,ids)=>Promise.resolve({data:window.__fake.orgs,error:null})})})
})};
