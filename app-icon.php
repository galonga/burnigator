<?php
declare(strict_types=1);
require_once __DIR__ . '/auth.php';
$config = require __DIR__ . '/config.php';
startAppSession($config, false);
$size=(int)($_GET['size']??192);
$fallback=[180=>'assets/apple-touch-icon.png',192=>'assets/app-icon-192.png',512=>'assets/app-icon-512.png'];
if(!isset($fallback[$size])){http_response_code(404);exit;}
header('Content-Type: image/png');
header('Cache-Control: no-cache, no-store, must-revalidate');
$mapPath=__DIR__.'/data/map.json';
$map=is_file($mapPath)?json_decode((string)file_get_contents($mapPath),true):null;
if(is_array($map)&&($map['published']??true)!==true&&!appCanPreviewUnpublished()){http_response_code(404);header('Cache-Control: no-store');exit;}
header('X-Burnigator-Published: '.(!is_array($map)||($map['published']??true)===true?'true':'false'));
$favicon=is_array($map)?(string)($map['favicon']??''):'';
$source=preg_match('~^uploads/favicon-[a-f0-9]{24}\.png$~',$favicon)&&is_file(__DIR__.'/'.$favicon)?__DIR__.'/'.$favicon:'';
if($source!==''&&function_exists('imagecreatefrompng')&&function_exists('imagecreatetruecolor')){
    $original=@imagecreatefrompng($source);
    if($original!==false){
        $width=imagesx($original);$height=imagesy($original);$canvas=imagecreatetruecolor($size,$size);
        $background=imagecolorallocate($canvas,230,208,187);imagefill($canvas,0,0,$background);
        imagealphablending($canvas,true);
        $scale=min(($size*0.82)/max(1,$width),($size*0.82)/max(1,$height));
        $targetWidth=max(1,(int)round($width*$scale));$targetHeight=max(1,(int)round($height*$scale));
        imagecopyresampled($canvas,$original,(int)(($size-$targetWidth)/2),(int)(($size-$targetHeight)/2),0,0,$targetWidth,$targetHeight,$width,$height);
        imagepng($canvas);imagedestroy($canvas);imagedestroy($original);exit;
    }
}
readfile(__DIR__.'/'.$fallback[$size]);
