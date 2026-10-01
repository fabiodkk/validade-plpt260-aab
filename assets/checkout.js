'use strict';
const ENDPOINT='https://suipuquznkksgrkchqrv.functions.supabase.co/validity-public-checkout';
const el=id=>document.getElementById(id),form=el('checkout-form');
let phase='data',pending=false,details=null,pix='',reviewRequired=false;
const digits=value=>String(value||'').replace(/\D/g,'');
function validCnpj(value){
  if(!/^\d{14}$/.test(value)||/^(\d)\1+$/.test(value))return false;
  const check=(part,weights)=>{const n=[...part].reduce((s,v,i)=>s+Number(v)*weights[i],0)%11;return n<2?0:11-n;};
  return check(value.slice(0,12),[5,4,3,2,9,8,7,6,5,4,3,2])===Number(value[12])&&check(value.slice(0,13),[6,5,4,3,2,9,8,7,6,5,4,3,2])===Number(value[13]);
}
function notice(message,error=true){el('notice').textContent=message;el('notice').className=error?'notice error':'notice';el('notice').hidden=!message;}
function setPhase(value){
  phase=value;el('data-fields').hidden=value!=='data';el('review-fields').hidden=value!=='review';el('payment').hidden=value!=='pix';
  for(const step of ['data','review','pix'])el('step-'+step).classList.toggle('active',step===value);
  el('checkout-title').textContent={data:'Vamos começar?',review:'Tudo certo com seus dados?',pix:'Pague pelo seu banco'}[value];
  el('step-hint').textContent={data:'Use o telefone que você utiliza no app.',review:'Confira antes de gerar sua mensalidade.',pix:'Sua mensalidade de R$ 149,90 está pronta para pagamento.'}[value];notice('');
}
function readDetails(){
  const name=el('name').value.trim(),establishment=el('establishment').value.trim();let phone=digits(el('phone').value);
  if(phone.length===13&&phone.startsWith('55'))phone=phone.slice(2);
  if(!/^[1-9]\d9\d{8}$/.test(phone))throw Error('Informe um celular brasileiro com DDD: (11) 99999-9999.');
  const document=digits(el('document').value);if(!validCnpj(document))throw Error('Confira o CNPJ do contratante; o número informado não é válido.');
  if(name.length<3||name.length>80||establishment.length<2||establishment.length>80)throw Error('Preencha o nome e o estabelecimento.');
  return{name,phone:'55'+phone,document,establishment};
}
function showReview(){details=readDetails();const list=el('review-list');list.replaceChildren();
  for(const[label,value]of[['Responsável',details.name],['WhatsApp','+'+details.phone],['CNPJ',details.document],['Estabelecimento',details.establishment]]){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=label;dd.textContent=value;list.append(dt,dd);}setPhase('review');
}
async function generate(){
  if(pending||pix||reviewRequired)return;pending=true;el('generate').disabled=true;el('edit').disabled=true;el('generate').textContent='Gerando seu Pix…';notice('');
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),35000);
  try{
    const response=await fetch(ENDPOINT,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(details),signal:controller.signal,credentials:'omit',cache:'no-store'});const body=await response.json();
    if(!response.ok){const error=Error(response.status===429?'Limite de tentativas atingido. Aguarde alguns minutos.':typeof body.error==='string'?body.error:'Não foi possível gerar o Pix agora.');error.uncertain=response.status>=500;throw error;}
    if(body.amount_cents!==14990||typeof body.pix_copy_paste!=='string'||!body.pix_copy_paste.startsWith('000201')||body.pix_copy_paste.length>2048){const error=Error('Cobrança incompleta');error.uncertain=true;throw error;}
    pix=body.pix_copy_paste;setPhase('pix');el('pix-code').value=pix;el('reference').textContent='Referência: '+String(body.id||'').slice(0,80);
    try{new QRCode(el('qr'),{text:pix,width:220,height:220,colorDark:'#000000',colorLight:'#ffffff',correctLevel:QRCode.CorrectLevel.M});}catch{el('qr').textContent='Use o Pix copia e cola abaixo.';}
    el('payment').scrollIntoView({behavior:'smooth',block:'nearest'});
  }catch(error){const uncertain=error.uncertain||error.name==='AbortError'||error instanceof TypeError||error instanceof SyntaxError;
    notice(uncertain?'A conexão foi interrompida e não sabemos se a cobrança foi criada. Fale com o atendimento antes de tentar outra vez.':error.message);
    if(uncertain){reviewRequired=true;el('generate').textContent='Conferir com o atendimento';return;}
  }finally{clearTimeout(timer);pending=false;if(el('generate').textContent!=='Conferir com o atendimento'){el('generate').disabled=false;el('generate').textContent='Gerar meu Pix →';el('edit').disabled=false;}}
}
form.addEventListener('submit',event=>{event.preventDefault();try{if(phase==='data')showReview();else if(phase==='review')generate();}catch(error){notice(error.message);}});
el('edit').addEventListener('click',()=>{if(!pending&&!pix)setPhase('data');});
el('copy').addEventListener('click',async()=>{if(!pix)return;try{await navigator.clipboard.writeText(pix);el('copy').textContent='Código copiado ✓';setTimeout(()=>el('copy').textContent='Copiar código Pix',2500);}catch{el('pix-code').focus();el('pix-code').select();notice('Selecione e copie o código acima para colar no aplicativo do banco.',false);}});
el('document').addEventListener('input',event=>{const n=digits(event.target.value).slice(0,14);event.target.value=n.replace(/^(\d{2})(\d)/,'$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/,'$1.$2.$3').replace(/\.(\d{3})(\d)/,'.$1/$2').replace(/(\d{4})(\d)/,'$1-$2');});
