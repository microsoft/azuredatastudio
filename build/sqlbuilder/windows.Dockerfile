FROM mcr.microsoft.com/windows:2004

RUN powershell -Command Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://chocolatey.org/install.ps1'))

RUN choco install nodejs --version=12.14.0 --yes
RUN choco install git --yes
# RUN choco install python --version=2.7.11 --yes

RUN npm install -g yarn
RUN npm install -g windows-build-tools --vs2015

WORKDIR "C:/ads"

RUN git clone https://github.com/microsoft/azuredatastudio.git

COPY build.js .

ENTRYPOINT [ "node", "build.js" ]
