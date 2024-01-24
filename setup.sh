#!/bin/sh

#パッケージ更新、自動削除してキャッシュクリーンするやつ
sudo apt update && sudo apt full-upgrade -y && sudo apt autoremove -y && sudo apt autoclean -y
#パッケージ削除済みだか残留した設定ファイルをすべて削除するやつ
sudo apt purge -y $(dpkg -l | grep '^rc' | awk '{print $2}')

#ひろいもの