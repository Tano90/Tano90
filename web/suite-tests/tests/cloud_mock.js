window.__fake = { orgs:[], memberships:[], snapshots:{}, user:{id:'u1',email:'test@example.org'} };
window.supabase = {createClient:()=>({
  auth:{getSession:async()=>({data:{session:null},error:null}),
        signInWithPassword:async()=>({data:{session:{user:window.__fake.user}},error:null}),
        signUp:async()=>({data:{session:{user:window.__fake.user}},error:null}),
        signOut:async()=>({error:null}),
        resetPasswordForEmail:async()=>({error:null})},
  rpc:async(name,args={})=>{
    const f=window.__fake;
    if(name==='glb_accept_invitations')return {data:0,error:null};
    if(name==='glb_create_workspace'){
      const id='org-'+(f.orgs.length+1); f.orgs.push({id,name:args.p_name});f.memberships.push({organization_id:id,user_id:f.user.id,role:'owner'});f.snapshots[id]={data:{},revision:0};return {data:id,error:null};
    }
    if(name==='glb_save_snapshot'){
      const old=f.snapshots[args.p_org];
      if(old.revision!==args.p_expected_revision)return {data:null,error:{message:'REVISION_CONFLICT'}};
      old.data=args.p_data;old.revision++;return{data:old.revision,error:null};
    }
    if(name==='glb_list_members') return {data:[{user_id:f.user.id,email:f.user.email,role:'owner'}],error:null};
    if(name==='glb_invite_member'){f.invited=args;return {data:null,error:null};}
    return {data:null,error:{message:'Unknown RPC: '+name}};
  },
  from:(table)=>({select:()=>({
    eq:(k,v)=>({then(resolve){const f=window.__fake;let data=[];
      if(table==='glb_memberships')data=f.memberships.filter(m=>m.user_id===v);
      if(table==='glb_snapshots')data=f.snapshots[v];
      return Promise.resolve(resolve({data,error:null}));},
      single(){return Promise.resolve({data:window.__fake.snapshots[v],error:null});}}),
    in:(k,ids)=>Promise.resolve({data:window.__fake.orgs.filter(o=>ids.includes(o.id)),error:null})
  })})
})};
