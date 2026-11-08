<?php
declare(strict_types=1);
header('Content-Type: application/manifest+json; charset=utf-8');
header('Cache-Control: no-cache, no-store, must-revalidate');
$mapPath=__DIR__.'/data/map.json';
$map=is_file($mapPath)?json_decode((string)file_get_contents($mapPath),true):null;
$favicon=is_array($map)?(string)($map['favicon']??''):'';
$customIcon=preg_match('~^uploads/favicon-[a-f0-9]{24}\.png$~',$favicon)&&is_file(__DIR__.'/'.$favicon);
$iconVersion=$customIcon?basename($favicon):'default';
$icons=[];
if($customIcon){
    foreach([192,512] as $size)$icons[]=['src'=>'app-icon.php?size='.$size.'&v='.$iconVersion,'sizes'=>$size.'x'.$size,'type'=>'image/png','purpose'=>'any maskable'];
}else{
    $icons[]=['src'=>'assets/app-icon-192.png','sizes'=>'192x192','type'=>'image/png','purpose'=>'any'];
    $icons[]=['src'=>'assets/app-icon-512.png','sizes'=>'512x512','type'=>'image/png','purpose'=>'any maskable'];
}
echo json_encode(['id'=>'./','name'=>'Burnigator','short_name'=>'Burnigator','description'=>'Burnigator festival map and program','start_url'=>'./index.php?source=installed-app','scope'=>'./','display'=>'standalone','orientation'=>'any','background_color'=>'#E6D0BB','theme_color'=>'#305EAA','icons'=>$icons],JSON_UNESCAPED_SLASHES|JSON_UNESCAPED_UNICODE);
