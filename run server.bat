@echo off
title=server
serve --debug --ssl-cert RootCA.crt --ssl-key RootCA.key .
exit

