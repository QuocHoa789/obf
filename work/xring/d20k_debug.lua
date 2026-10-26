return ({ Wm = setfenv,eH = function(T, q, z, C, xX)
  local oB = { z,C,xX,};
  for fG =0x30, 0x30, 44.0 do
    T:U(q, fG, oB);
    end;
  return { T.z(T:m(q, oB)),};
  end,m = function(T, T, x)
  local i = (x)[0X4];
  return { i,};
  end,lU = function(T, T, jR)
  return {};
  end,Nf = function(T, Nc, s, L)
  L[1] = T.w((Nc[0x1])[0X31], Nc[0b1][0x21] - 1);
  (Nc[0x1])[0x21] = (Nc[0X1][0x21] + 1);
  end,Xz = function(T, T, Y)
  return (((((T - Y[9.0]) + Y[0x7]) + (Y)[11.0]) - Y[0x9]) + Y[0XB]);
  end,sK = function(T, z, r)
  return (z[1])[0b101001](r[1.0], ".....", T.x({}, { __index = function(jR, J)
    local G,Ud,rZ,B,fF = (z[0X1])[29.0](J, 1, 5);
    local i = (((((fF - 33) + ((B - 33) * 85)) + ((rZ - 33) * 7225)) + ((Ud - 33) * 614125)) + ((G - 33) * 52200625));
    G = (i % 256);
    i = (i - G) / 256;
    Ud = (i % 256);
    i = ((i - Ud) / 256);
    rZ = i % 256;
    i = ((i - rZ) / 256);
    B = ((rZ + Ud) > rZ + Ud and Ud - G or (G > G and Ud - G or i % 256));
    local F = (r[0x2])[B] .. (r[0B10])[rZ] .. (r[0X2])[Ud] .. r[2][G];
    jR[J] = F;
    return F;
    end,}));
  end,Du = function(T, j, g)
  if j >= 0xec then
    g[1.0][0x2d] = (T.Ud);
    elseif(j > 0XAE) then
    (g[1])[0B10110] = T.pH;
    elseif not (j < 0x72) then
    (g[0X1])[62.0] = (T.L);
    else
    if(not ((j == 0B110101))) then
      else
      (g[0x1])[0b100110] = (T.gJ);
      end;
    end;
  end,u = function(T, T, ...)
  return (...)[...];
  end,Rz = function(T, T, qU, Ow, M)
  local h = (qU[Ow]);
  if((T[0x1])[0B10000](h) == "number" and (h >= 1)) and (h < Ow) then
    for Oj =h, Ow do
      M[Oj] = true;
      end;
    end;
  end,iU = function(T, s, Fs)
  return T.r((- 0X2ED89170 + ((((((Fs[7.0] + (Fs)[0X8]) - Fs[0B1101]) + (Fs)[0B111]) - Fs[0xd]) + Fs[0XD]))), (0X0));
  end,I = string.sub,B = function(T, T, e)
  local P = e[0X1];
  return { P,};
  end,P = function(T, T, ...)
  return (...)();
  end,Ue = function(T, e, G, Ke)
  local v = e[1.0][0x9](T, e);
  if((e)[0b1][0x19])[v] then
    (G)[Ke] = ((e)[0x1][0b11001][v]);
    else
    local Y = (v / 4);
    Y = (Y - (Y % 1));
    local L = ({ Y,v % 4,});
    (e[0x1][25.0])[v] = L;
    G[Ke] = L;
    end;
  end,dL = function(T, T, Q)
  local e = Q[0B10];
  return { e,};
  end,dT = function(T, T, d)
  local Lc = ((d)[0b1]);
  return { Lc,};
  end,M = select,Y = function(T, Y, x, Q)
  return (Y[0x1])[38.0]((Y)[1][0xf](x) or 0, Y[1.0][0xf](Q) or 0);
  end,U = function(T, x, R, O)
  O[4.0] = (((O[0x1_] / (2 ^ O[0x3]))) % (2 ^ (O)[0b10]));
  O[4] = (O[0x4] - ((O)[4.0] % 1));
  end,hH = string.char,Op = function(T, O, b, C)
  if not (b < 0x8e) then
    for D =0, 255 do
      (C[2.0])[D] = (O[0b1])[0B101100](D);
      end;
    else
    C[0X1] = (O[1.0])[0x29](C[0x1], "z", "!!!!!");
    C[0X2] = {};
    end;
  end,Pn = "Lightray",y = function(T, w, uX)
  local q = (uX[0x1]);
  return { q,};
  end,Ud = function(T, T, L, uP, Iv)
  (L[14])[uP] = true;
  L[10][uP] = (T[0X1])[0XB][Iv];
  end,Su = string.gsub,aC = function(T, T, ...)
  local F;
  F = T[0B1][0x6]("#", ...);
  if F == 0 then
    return F, (T[0b1])[39.0];
    end;
  return F, { ...,};
  end,fS = function(T, cN, J, z)
  if J >= 0X8E then
    z[0X12] = ((z)[0X1])[16];
    z[0X13] = z[0B1][20];
    z[0x14] = function(...)
      local Vm,jG,w,yL,Ol,Bf,c,m,A,q,pM,rW,kN,jW,B,N,Q,n,R,d,G,oJ,qB,zB,L,i,D,x,mX;
      Vm = cN[0x1][0B110100](T, cN, (z)[0b11]);
      jG, w = 1, 1;
      yL = {};
      Ol, Bf = (cN[0X1])[0X38](T, cN, ...);
      c, m = 0, 1;
      A, q = (cN[0x1])[0b11], (cN[1.0])[48.0];
      pM, rW = nil, nil;
      Q = ((z[0B1])[21]);
      n = {};
      if z[0X1][15] then
        for r,p in T.S((z[0X1])[15]) do
          if(not p[4]) then
            p[4] = true;
            local O = 0;
            for I =p[1], (p[1] + p[2]) - 1 do
              O = (O + 1);
              local H = (cN[0b1])[0x36](T, cN, (cN[0X1])[0B100101](T, cN, p[3], O), 127);
              z[1.0][3][I] = (cN[0x1])[0X25](T, cN, z[0X1][3][I], H);
              if(not z[0X1][12][I]) then
                (z[0B1][5])[I] = cN[0x1][37.0](T, cN, z[1.0][5][I], H);
                end;
              if not (z[0x1][13])[I] then
                ((z)[0X1][4])[I] = (cN[0x1])[37.0](T, cN, (((z)[1.0])[4])[I], H);
                end;
              if not (z[0x1])[14][I] then
                ((z)[0x1][10])[I] = cN[0X1][37](T, cN, (z[0B1][10])[I], H);
                end;
              end;
            end;
          end;
        end;
      R = function(g)
        if cN[1][0x10](g) == "table" then
          return cN[0b1][0B101100]((cN[1])[0x17](g));
          end;
        return g;
        end;
      d = function(Kx)
        if z[0XD][Kx] then
          return R((z[0b110])[Kx]);
          end;
        return Vm[z[0x6][Kx]];
        end;
      G = function(Dk)
        if z[14.0][Dk] then
          return R((z[11.0])[Dk]);
          end;
        return Vm[(z[0xb])[Dk]];
        end;
      oJ = function(X)
        local yO = X % 3;
        if yO == 0 then
          return z[0xf];
          else
          if yO == 1 then
            return z[0x10];
            else
            return z[0B10001];
            end;
          end;
        end;
      qB = (z)[0B1][1];
      for dC =1, qB do
        Vm[dC - 1] = (Bf[dC]);
        end;
      zB = Ol - qB;
      if zB < 0 then
        zB = 0;
        end;
      L = {};
      for lE =1, zB do
        (L)[lE - 1] = (Bf[qB + lE]);
        end;
      i, D, x, mX = ((cN)[0X1])[0x3d](function()
        while true do
          local b = (z[5][w]);
          local C;
          if(b >= 128) then
            local p = (cN[0x1])[20.0](T, cN, w);
            ((z)[0x5])[w] = cN[1][0X25](T, cN, b - 128, p);
            z[0b111][w] = ((cN)[0b1])[0x25](T, cN, (z[0b111])[w], p);
            z[6.0][w] = ((cN)[1.0])[0x25](T, cN, z[0B110][w], p);
            z[11.0][w] = (cN[0b1])[37.0](T, cN, (z[11.0])[w], p);
            C = z[0X5][w];
            if z[19.0] then
              local Mb = (z)[0x13][w];
              if Mb then
                C = Mb;
                end;
              end;
            local E = z[18.0] and (z[0X12])[w] or 0;
            if C >= 0B10110 then
              if not (C < 0b10_00_01) then
                if(not (C < 0b111010)) then
                  if not (C < 61) then
                    if C < 0X3E then
                      do
                        local Kv,o,Yt = (w + 1), (z[0b110])[w], (z[0xb][w]);
                        local y = 0;
                        for X =Kv, (Kv + o) - 1 do
                          y = (y + 1);
                          local g = (cN[0b1])[0X36](T, cN, cN[0B1][0X25](T, cN, Yt, y), 127);
                          z[0x5][X] = (cN[1.0])[0b100101](T, cN, (z[0b101])[X], g);
                          if(not (z)[0X1][12][X]) then
                            if Kv > Kv then
                              y = T[0X1][0b101001]((((((y + b) - C) - E) + o) - E), (X));
                              elseif o == o then
                              z[0B111][X] = ((cN)[0x1])[0X25](T, cN, z[7.0][X], g);
                              elseif E >= 0x6 then
                              Kv = T[0B1][49]((((o + b) > y + o and X or X - o) == (E + o) - b and b or C), (X));
                              else
                              E = y + 0X1;
                              end;
                            end;
                          if not (z)[0X1][13][X] then
                            if y > y then
                              b = T[0x1][14](((((C - E) + Kv) - o) - o), (E));
                              elseif o == o then
                              z[6.0][X] = (cN[1.0])[37](T, cN, z[0X6][X], g);
                              elseif E >= 0x6 then
                              X = T[1.0][14.0]((((((y + Kv) - E) - b) + o) - b), (C));
                              else
                              b = E + 0X1;
                              end;
                            end;
                          if not (z[0X1][14])[X] then
                            z[0xb][X] = (cN[0B1])[0X25](T, cN, z[0b1011][X], g);
                            end;
                          end;
                        end;
                      elseif(not (C >= 63.0)) then
                      do
                        w = 0;
                        C = - (1);
                        Vm = nil;
                        z[5.0] = nil;
                        z[0x7] = nil;
                        z[6.0] = nil;
                        (z)[11] = nil;
                        (z)[0x1] = nil;
                        cN[0x1][0X39]("XRN}", 0);
                        end;
                      else
                      Vm[z[0X7][w]] = (cN[0x1])[0b111011][z[0B110][w]];
                      end;
                    else
                    if C <= 58 then
                      local S,v,fG = (z[0X7])[w], (z[0B110][w]), z[0xb][w];
                      if v ~= 0 then
                        jG = ((S + v) - 1);
                        end;
                      local Y = T.Kv((Vm)[S]);
                      rW = { [5] = pM,[6] = jG,[7] = w,[8] = rW,};
                      pM = Y;
                      local W,y;
                      if v ~= 1 then
                        W, y = (cN[1.0])[0x38](T, cN, Y(cN[0B1][4.0](T, cN, Vm, jG, S + 1)));
                        else
                        W, y = cN[0b1][56](T, cN, Y());
                        end;
                      local h = rW;
                      if h then
                        pM = (h[5]);
                        rW = (h[8]);
                        end;
                      if fG ~= 1 then
                        if fG == 0 then
                          W = ((W + S) - 1);
                          jG = (S > S and fG - S or W);
                          else
                          W = (S + fG) - 2;
                          jG = (b > b and fG - b or W + 1);
                          end;
                        local iR = 0;
                        for Lg =S, W do
                          iR = (iR + 1);
                          Vm[Lg] = (y[iR]);
                          end;
                        else
                        jG = S - 1;
                        end;
                      elseif not (C >= 60) then
                      local wA = (z)[7.0][w];
                      local f,j,I = pM();
                      Vm[wA] = f;
                      if f ~= nil then
                        (Vm)[wA + 1] = j;
                        Vm[wA + 2] = I;
                        end;
                      else
                      local v = rW;
                      if v then
                        pM = (v[5]);
                        jG = v[6];
                        w = v[7];
                        rW = ((v)[8]);
                        end;
                      end;
                    end;
                  else
                  if C > 34 then
                    if C <= 0X23 then
                      Vm[z[0B111][w]][d(w)] = G(w);
                      else
                      if(C < 0B10_01_01) then
                        (Vm)[z[0X7][w]] = (d(w)) / (G(w));
                        else
                        Vm[(z[0b111])[w]] = (d(w)) ^ (G(w));
                        end;
                      end;
                    else
                    if C < 0x22 then
                      A()[R(z[6.0][w])] = Vm[(z)[7.0][w]];
                      else
                      local s,eP = ((z[0b110])[w]), (z[11.0])[w];
                      if eP == 0 then
                        eP = 1;
                        end;
                      local W = ((eP - 1) * 50);
                      local Sa = ((s == 0) and jG or (z[7.0][w] + s));
                      local oL = (Vm[z[7][w]]);
                      for u =(z)[7.0][w] + 1, Sa do
                        oL[W + (u - (z[0x7])[w])] = (Vm)[u];
                        end;
                      end;
                    end;
                  end;
                else
                if not (C < 0X1B) then
                  if not (C < 0b11110) then
                    if not (C >= 31.0) then
                      Vm[(z[0B111])[w]] = (d(w)) % (G(w));
                      else
                      if C < 0B100_000 then
                        Vm[(z[0x7])[w]] = Vm[(z[0b110])[w]];
                        else
                        local Zn = ((z[0b111])[w]);
                        local U = (z[0b1011][w]);
                        local a = Zn + 3;
                        if U == 2 then
                          (Vm)[a], Vm[a + 1] = Vm[Zn](Vm[Zn + 1], Vm[Zn + 2]);
                          elseif U == 1 then
                          Vm[a] = (Vm)[Zn](Vm[Zn + 1], Vm[Zn + 2]);
                          else
                          local M = { Vm[Zn](Vm[Zn + 1], Vm[Zn + 2]),};
                          for S =1, U do
                            Vm[(a + S) - 1] = M[S];
                            end;
                          end;
                        if Vm[a] ~= nil then
                          Vm[(Zn + 2)] = Vm[a];
                          else
                          w = w + 1;
                          end;
                        end;
                      end;
                    else
                    if not (C >= 0X1C) then
                      local Hj = ((z[0x2])[(z[0b110])[w]]);
                      if Hj[4] then
                        Vm[z[0b111][w]] = (Hj[3]);
                        else
                        Vm[((z)[7.0])[w]] = (((Hj)[2])[Hj[1]]);
                        end;
                      else
                      if C < 0X1D then
                        local F,M,k = (z[7.0][w]), ((z)[0x6][w]), z[0XB][w];
                        if M ~= 0 then
                          jG = ((F + M) - 1);
                          end;
                        local Lk,Xv;
                        if M ~= 1 then
                          Lk, Xv = (cN[0x1])[0b111000](T, cN, (Vm)[F]((cN[1.0])[0x4](T, cN, Vm, jG, F + 1)));
                          else
                          Lk, Xv = cN[0B1][0x38](T, cN, Vm[F]());
                          end;
                        if k ~= 1 then
                          if k == 0 then
                            Lk = ((Lk + F) - 1);
                            jG = Lk;
                            else
                            Lk = (F + k) - 2;
                            jG = (k > k and b - k or Lk + 1);
                            end;
                          local Op = 0;
                          for W =F, Lk do
                            Op = Op + 1;
                            Vm[W] = (Xv)[Op];
                            end;
                          else
                          jG = F - 1;
                          end;
                        else
                        if((not (Vm)[(z[6.0])[w]])) ~= (z[0xb][w] ~= 0) then
                          Vm[z[0x7][w]] = (Vm[(z[0x6])[w]]);
                          else
                          w = (w + 1);
                          end;
                        end;
                      end;
                    end;
                  else
                  if(not ((C >= 0x18_))) then
                    if(not (C >= 0x17_)) then
                      local P,s = (z)[0B111][w], z[0x6][w];
                      if(s == 0) then
                        return false, P, jG;
                        else
                        if(s == 1) then
                          return false, nil, nil;
                          else
                          return false, P, (P + s) - 2;
                          end;
                        end;
                      else
                      local y = ((z)[6])[w] - 1;
                      if y == - (1) then
                        y = zB;
                        jG = ((z[0X7])[w] + y) - 1;
                        end;
                      for hJ =0, y - 1 do
                        Vm[z[0x7][w] + hJ] = (L[hJ]);
                        end;
                      end;
                    else
                    if(C <= 0B11000) then
                      local K = Vm[(z[0x6])[w]];
                      for I =(z[0X6])[w] + 1, z[0B1011][w] do
                        K = K .. Vm[I];
                        end;
                      Vm[z[0b111][w]] = K;
                      else
                      if C <= 0x19 then
                        w = ((z)[6.0])[w];
                        else
                        Vm[(z)[0b111][w]] = A()[R(z[0X6][w])];
                        end;
                      end;
                    end;
                  end;
                end;
              elseif not (C >= 11) then
              if(not (C >= 0b101)) then
                if C < 2 then
                  if C < 1.0 then
                    local Z = z[0xa][w];
                    local K = z[0x6][w];
                    local H = K > 0 and {};
                    local I = (cN[1.0])[0X33](T, cN, Z, H);
                    q(I, A());
                    Vm[z[0x7][w]] = I;
                    if H then
                      for f =1, K do
                        w = w + 1;
                        local h = ((z[5.0])[w]);
                        local U;
                        if h >= 128 then
                          local p = cN[0X1][0X14](T, cN, w);
                          (z)[0b101][w] = cN[0b1][37](T, cN, h - 128, p);
                          (z[0x7])[w] = (cN[0X1])[37](T, cN, (z[0B111])[w], p);
                          z[6][w] = (cN[1])[0x25](T, cN, z[6.0][w], p);
                          ((z)[0xb])[w] = (cN[0x1])[0X25](T, cN, z[0xb][w], p);
                          U = (z[0x5])[w];
                          else
                          U = h;
                          end;
                        if U == 31 then
                          local v = ({ z[6.0][w],Vm,});
                          H[f - 1] = v;
                          yL[# yL + 1] = v;
                          else
                          H[f - 1] = (z[2.0][z[0x6][w]]);
                          end;
                        end;
                      end;
                    else
                    Vm[(z[7.0])[w]] = (# (Vm)[z[0x6][w]]);
                    end;
                  else
                  if C < 0X3_ then
                    Vm[((z)[0x7])[w]] = {};
                    elseif C <= 0X3 then
                    local o = d(w);
                    local f = G(w);
                    if(o <= f) ~= ((((z)[7.0])[w] ~= 0)) then
                      w = (w + 1);
                      end;
                    else
                    local F = (z[0B10])[z[6.0][w]];
                    if F[4] then
                      F[3] = Vm[z[0x7][w]];
                      else
                      F[2][(F)[1]] = Vm[z[0x7][w]];
                      end;
                    end;
                  end;
                else
                if C <= 0B111 then
                  if C <= 5 then
                    local j = d(w);
                    local e = G(w);
                    if(j == e) ~= ((z)[7.0][w] ~= 0) then
                      w = (w + 1);
                      end;
                    else
                    if C <= 0X6 then
                      Vm[z[7.0][w]] = (d(w)) * (G(w));
                      else
                      Vm[((z)[0x7])[w]] = not Vm[(z[0b110])[w]];
                      end;
                    end;
                  elseif C <= 0x8 then
                  Vm[(z[7.0])[w]] = (d(w)) - (G(w));
                  elseif not (C >= 0xa) then
                  local h = (z[0b111][w]);
                  Vm[h] = Vm[h] - (Vm)[h + 2];
                  w = (z[0b110][w]);
                  else
                  local P = d(w);
                  local F = G(w);
                  if(P < F) ~= ((z[0x7])[w] ~= 0) then
                    w = w + 1;
                    end;
                  end;
                end;
              else
              if C < 0x10 then
                if C >= 0xd then
                  if(not (C >= 0XE)) then
                    if(not Vm[z[0B111][w]]) ~= ((z[0B1011])[w] ~= 0) then
                      else
                      w = w + 1;
                      end;
                    else
                    if not (C >= 0B1111) then
                      Vm[(z[0x7])[w]] = - Vm[z[0x6][w]];
                      else
                      Vm[z[7.0][w]] = R(z[0b110][w]);
                      end;
                    end;
                  else
                  if not ((C >= 12)) then
                    for X =(z)[7][w], z[6.0][w] do
                      (Vm)[X] = nil;
                      end;
                    else
                    local nE,hN = (z[0x7])[w], (z)[0X6][w];
                    if hN ~= 0 then
                      jG = ((nE + hN) - 1);
                      end;
                    if hN ~= 1 then
                      return true, nE, jG;
                      else
                      return true, nE, 0;
                      end;
                    end;
                  end;
                else
                if C < 19.0 then
                  if C < 0X11 then
                    local Hi = (Vm[z[6.0][w]]);
                    Vm[(z[0b111])[w] + 1] = Hi;
                    Vm[((z)[0b111])[w]] = (Hi[G(w)]);
                    elseif C <= 17 then
                    Vm[(z[0x7])[w]] = z[0x6][w] ~= 0;
                    if(z[0XB])[w] ~= 0 then
                      w = (w + 1);
                      end;
                    else
                    local sH = (z[7.0])[w];
                    for Ya =1, # yL do
                      local jA = yL[Ya];
                      if(not jA[4] and (jA[2] == Vm)) and (jA[1] >= sH) then
                        jA[3] = ((jA[2])[(jA)[1]]);
                        jA[4] = true;
                        end;
                      end;
                    end;
                  elseif not (C >= 20) then
                  local nU = z[7][w];
                  local Fu = (Vm[(nU + 2)]);
                  local Sy = Vm[nU] + Fu;
                  Vm[nU] = Sy;
                  if(Fu > 0 and (Sy <= Vm[nU + 1])) or ((Fu <= 0) and (Sy >= Vm[nU + 1])) then
                    (Vm)[nU + 3] = Sy;
                    w = z[6.0][w];
                    end;
                  elseif not (C >= 0x15) then
                  Vm[z[0X7][w]] = (Vm[z[0x6][w]])[G(w)];
                  else
                  Vm[(z)[0X7][w]] = (d(w)) + (G(w));
                  end;
                end;
              end;
            if T.w((cN[0x1])[0b110001], 33618) == 2 then
              else
              Vm[27] = Vm[(z[0X7])[w]] % Vm[z[11][w]];
              end;
            if(((T.w((cN[0X1])[0b110001], 33371) * 631 + 316) % 55645)) < 316 then
              cN[0X1_][0X39]("bad argument");
              else
              do
                local v = T.w((cN[1.0])[0X31], 34035);
                end;
              end;
            if(Vm[z[6][w] or 0] == Vm[z[6.0][w] or 0]) then
              if T.w((cN[1])[0X31], 17826) <= 137 then
                else
                break;
                end;
              else
              (cN[0B1])[0X39]("bad argument");
              end;
            if T.w((cN[0B1])[0x31], (E > E and b - E or 222)) ~= 186 then
              Vm[(z[6])[w]] = 110 * Vm[z[0X7][w]];
              end;
            if((T.w(cN[1.0][49], 8933) * 995 + 907) % 37718) >= 463 then
              do
                local cF = T.w(((cN)[0X1])[0b110001_], 16935);
                end;
              end;
            w = (w + 1);
            elseif false then
            w = w + 1;
            else
            C = b;
            if(z)[19.0] then
              local t = (z[0B10011])[w];
              if t then
                C = t;
                end;
              end;
            local H = z[18] and z[0B10010][w] or 0;
            if C >= 0B10110 then
              if not (C < 0b10_00_01) then
                if not (C < 0b111010) then
                  if(not (C < 61)) then
                    if C < 0X3E then
                      do
                        local j,Sk,K = (w + 1), (z[0x6])[w], ((z[11.0])[w]);
                        local sA = 0;
                        for Ri =j, ((j + Sk) - 1) do
                          sA = (sA + 1);
                          local kR = (cN[0X1])[54](T, cN, (cN[1])[37](T, cN, K, sA), 127);
                          z[0x5][Ri] = (cN[1.0])[37](T, cN, (z[5.0])[Ri], kR);
                          if not ((z[1.0])[12])[Ri] then
                            (z[0X7])[Ri] = (cN)[0b1][0x25](T, cN, (z)[0x7][Ri], kR);
                            end;
                          if(not (z[0X1])[13][Ri]) then
                            ((z)[0b110])[Ri] = cN[0b1][37](T, cN, z[0X6][Ri], kR);
                            end;
                          if(not (z)[0X1][14][Ri]) then
                            (z[0xb])[Ri] = (cN[1.0])[0B100101](T, cN, z[0XB][Ri], kR);
                            end;
                          end;
                        end;
                      else
                      if not (C >= 63.0) then
                        do
                          w = 0;
                          C = (- (1));
                          Vm = nil;
                          z[5.0] = nil;
                          z[0X7] = nil;
                          (z)[0b110] = nil;
                          (z)[0XB] = nil;
                          z[0x1] = nil;
                          ((cN)[1.0])[57]("XRN}", 0);
                          end;
                        else
                        Vm[z[7][w]] = (cN[1.0][0X3B])[z[0x6][w]];
                        end;
                      end;
                    else
                    if(C <= 58) then
                      local mU,Th,t = z[7][w], z[0X6][w], ((z)[11.0])[w];
                      if Th ~= 0 then
                        jG = (((mU + Th) - 1));
                        end;
                      local v = T.Kv(Vm[mU]);
                      rW = { [5] = pM,[6] = jG,[7] = w,[8] = rW,};
                      pM = v;
                      local Cs,U;
                      if Th ~= 1 then
                        Cs, U = (cN[1.0])[56.0](T, cN, v(cN[0x1][0B100](T, cN, Vm, jG, mU + 1)));
                        else
                        Cs, U = ((cN)[1.0])[0x38](T, cN, v());
                        end;
                      local r = rW;
                      if r then
                        pM = r[5];
                        rW = ((r)[8]);
                        end;
                      if t ~= 1 then
                        if t == 0 then
                          Cs = ((Cs + mU) - 1);
                          jG = Cs;
                          else
                          Cs = (mU + t) - 2;
                          jG = Cs + 1;
                          end;
                        local g = 0;
                        for k =mU, Cs do
                          g = (g + 1);
                          (Vm)[k] = U[g];
                          end;
                        else
                        jG = (r > r and mU - r or (mU - 1));
                        end;
                      else
                      if(not (C >= 60)) then
                        local pW = (z[7.0][w]);
                        local g,S,W = pM();
                        Vm[pW] = g;
                        if g ~= nil then
                          Vm[(pW + 1)] = S;
                          Vm[pW + 2] = W;
                          end;
                        else
                        local Ko = rW;
                        if Ko then
                          pM = (Ko)[5];
                          jG = ((Ko)[6]);
                          w = (Ko[7]);
                          rW = (Ko)[8];
                          end;
                        end;
                      end;
                    end;
                  else
                  if C > 34 then
                    if C <= 0X23 then
                      (Vm[((z)[0B111])[w]])[d(w)] = G(w);
                      else
                      if C < 0B10_01_01 then
                        Vm[z[0b111][w]] = (d(w)) / (G(w));
                        else
                        Vm[z[7.0][w]] = (d(w)) ^ (G(w));
                        end;
                      end;
                    elseif C < 0x22 then
                    A()[R(z[0b110][w])] = Vm[z[0x7][w]];
                    else
                    local kZ,F = (z[0X6])[w], (z)[11][w];
                    if(F == 0) then
                      F = 1;
                      end;
                    local f = (F - 1) * 50;
                    local X = (kZ == 0 and jG or (z[0X7][w] + kZ));
                    local j = (Vm)[z[0X7][w]];
                    for nV =(z[0B111])[w] + 1, X do
                      j[f + (nV - z[0x7][w])] = ((Vm)[nV]);
                      end;
                    end;
                  end;
                elseif not (C < 0X1B) then
                if not (C < 0b11110) then
                  if not (C >= 31.0) then
                    Vm[(z)[7.0][w]] = (d(w)) % (G(w));
                    else
                    if C < 0B100_000 then
                      Vm[z[0x7][w]] = Vm[(z[6.0])[w]];
                      else
                      local I = ((z[0X7])[w]);
                      local eZ = (z[0xb][w]);
                      local h = (I + 3);
                      if eZ == 2 then
                        (Vm)[h], Vm[h + 1] = Vm[I](Vm[I + 1], Vm[I + 2]);
                        else
                        if eZ == 1 then
                          Vm[h] = Vm[I](Vm[I + 1], Vm[I + 2]);
                          else
                          local P = { Vm[I](Vm[I + 1], Vm[I + 2]),};
                          for e =1, eZ do
                            Vm[(h + e) - 1] = (P[e]);
                            end;
                          end;
                        end;
                      if(Vm[h] ~= nil) then
                        (Vm)[I + 2] = Vm[h];
                        else
                        w = (w + 1);
                        end;
                      end;
                    end;
                  else
                  if not (C >= 0X1C) then
                    local f = z[2.0][(z[0X6])[w]];
                    if f[4] then
                      (Vm)[(z[7.0])[w]] = f[3];
                      else
                      Vm[(z[7.0])[w]] = f[2][(f)[1]];
                      end;
                    else
                    if(C < 0X1D) then
                      local I,Un,U = ((z[0b111])[w]), (z[0X6][w]), ((z)[0xb])[w];
                      if Un ~= 0 then
                        jG = ((I + Un) - 1);
                        end;
                      local cJ,Fs;
                      if Un ~= 1 then
                        cJ, Fs = (cN[1.0])[0B111000](T, cN, Vm[I]((cN[1.0])[0x4](T, cN, Vm, jG, I + 1)));
                        else
                        cJ, Fs = (cN[1.0])[0x38](T, cN, Vm[I]());
                        end;
                      if U ~= 1 then
                        if(U == 0) then
                          cJ = (cJ + I) - 1;
                          jG = cJ;
                          else
                          cJ = (I + U) - 2;
                          jG = (cJ + 1);
                          end;
                        local y = 0;
                        for S =I, cJ do
                          y = y + 1;
                          Vm[S] = (Fs)[y];
                          end;
                        else
                        jG = I - 1;
                        end;
                      else
                      if(not Vm[((z)[0b110])[w]]) ~= ((z[0b1011])[w] ~= 0) then
                        Vm[(z)[0X7][w]] = Vm[(z[0X6])[w]];
                        else
                        w = (w + 1);
                        end;
                      end;
                    end;
                  end;
                else
                if not (C >= 0x18_) then
                  if not (C >= 0x17_) then
                    local E,F = z[7.0][w], (z[0x6][w]);
                    if F == 0 then
                      return false, (F > F and C - F or E), jG;
                      else
                      if F == 1 then
                        return false, nil, nil;
                        else
                        return false, E, (E + F) - 2;
                        end;
                      end;
                    else
                    local K = (z[6.0])[w] - 1;
                    if K == (- (1)) then
                      K = zB;
                      jG = (z[0x7][w] + K) - 1;
                      end;
                    for o =0, K - 1 do
                      Vm[(z[0b111])[w] + o] = L[o];
                      end;
                    end;
                  elseif C <= 0B11000 then
                  local qH = Vm[z[0x6][w]];
                  for g =(z[0B110])[w] + 1, z[0xb][w] do
                    qH = (qH .. Vm[g]);
                    end;
                  Vm[(z[7.0])[w]] = qH;
                  else
                  if C <= 0x19 then
                    w = z[0x6][w];
                    else
                    Vm[z[7][w]] = A()[R(z[0x6][w])];
                    end;
                  end;
                end;
              else
              if not (C >= 11) then
                if not (C >= 0b101) then
                  if C < 2 then
                    if C < 1.0 then
                      local O = z[0xa][w];
                      local y = (z[0B110][w]);
                      local e = y > 0 and {};
                      local o = cN[1.0][51.0](T, cN, O, e);
                      q(o, A());
                      Vm[(z[7])[w]] = o;
                      if e then
                        for E =1, y do
                          w = (w + 1);
                          local Er = z[0x5][w];
                          local I;
                          if Er >= 128 then
                            local Gs = cN[0x1][0b10100](T, cN, w);
                            z[0X5][w] = (cN[0x1])[37.0](T, cN, Er - 128, Gs);
                            z[0x7][w] = (cN[0X1])[0x25](T, cN, (z[7.0])[w], Gs);
                            (z[0x6])[w] = (cN[0x1])[0b100101](T, cN, ((z)[0B110])[w], Gs);
                            z[0xb][w] = cN[0X1][0x25](T, cN, z[0xb][w], Gs);
                            I = (((z)[0X5])[w]);
                            else
                            I = Er;
                            end;
                          if(I == 31) then
                            local P = ({ (z[0x6])[w],Vm,});
                            e[E - 1] = P;
                            yL[# yL + 1] = P;
                            else
                            (e)[E - 1] = ((z)[0x2][(z[0x6])[w]]);
                            end;
                          end;
                        end;
                      else
                      (Vm)[z[0x7][w]] = # Vm[(z[6.0])[w]];
                      end;
                    elseif C < 0X3_ then
                    Vm[(z[7])[w]] = {};
                    else
                    if C <= 0X3 then
                      local f = d(w);
                      local Tf = G(w);
                      if((f <= Tf)) ~= ((z[0B111])[w] ~= 0) then
                        w = (w + 1);
                        end;
                      else
                      local nY = ((z[0b10])[z[0x6][w]]);
                      if nY[4] then
                        nY[3] = Vm[(z[0x7_])[w]];
                        else
                        (nY[2])[nY[1]] = (Vm)[(z)[0x7][w]];
                        end;
                      end;
                    end;
                  elseif C <= 0B111 then
                  if C <= 5 then
                    local oD = d(w);
                    local Z = G(w);
                    if(oD == Z) ~= (z[0b111][w] ~= 0) then
                      w = w + 1;
                      end;
                    else
                    if(C <= 0X6) then
                      (Vm)[z[0B111][w]] = (d(w)) * (G(w));
                      else
                      (Vm)[z[0X7][w]] = (not Vm[(z[6.0])[w]]);
                      end;
                    end;
                  else
                  if C <= 0x8 then
                    Vm[z[0x7][w]] = (d(w)) - (G(w));
                    else
                    if not (C >= 0xa) then
                      local Ie = z[0x7][w];
                      Vm[Ie] = ((Vm)[Ie] - (Vm)[Ie + 2]);
                      w = ((z[6.0])[w]);
                      else
                      local r = d(w);
                      local U = G(w);
                      if(r < U) ~= (z[0x7][w] ~= 0) then
                        w = (w + 1);
                        end;
                      end;
                    end;
                  end;
                elseif C < 0x10 then
                if C >= 0xd then
                  if not (C >= 0XE) then
                    if(not Vm[z[0x7][w]]) ~= (z[0xb][w] ~= 0) then
                      else
                      w = w + 1;
                      end;
                    else
                    if not ((C >= 0B1111)) then
                      Vm[z[0X7][w]] = - Vm[((z)[6.0])[w]];
                      else
                      Vm[(z[7])[w]] = R(z[0B110][w]);
                      end;
                    end;
                  else
                  if not (C >= 12) then
                    for W =(z)[7][w], z[0X6][w] do
                      Vm[W] = nil;
                      end;
                    else
                    local I,k = z[0x7][w], (z[0b110][w]);
                    if k ~= 0 then
                      jG = (I + k) - 1;
                      end;
                    if k ~= 1 then
                      return true, I, jG;
                      else
                      return true, I, ((k + b) > k + b and C - I or (I > I and C - I or 0));
                      end;
                    end;
                  end;
                else
                if C < 19.0 then
                  if C < 0X11 then
                    local p = (Vm[((z)[6])[w]]);
                    Vm[(z[0x7])[w] + 1] = p;
                    Vm[z[0x7][w]] = p[G(w)];
                    else
                    if C <= 17 then
                      Vm[z[0X7][w]] = z[0X6_][w] ~= 0;
                      if((z)[0xb][w] ~= 0) then
                        w = w + 1;
                        end;
                      else
                      local oU = z[7.0][w];
                      for Y =1, # yL do
                        local F = yL[Y];
                        if(not F[4] and (F[2] == Vm)) and (F[1] >= oU) then
                          F[3] = (F[2][F[1]]);
                          F[4] = true;
                          end;
                        end;
                      end;
                    end;
                  else
                  if not ((C >= 20)) then
                    local xV = (z[7.0])[w];
                    local W = ((Vm)[xV + 2]);
                    local e = Vm[xV] + W;
                    (Vm)[xV] = (xV > xV and b - xV or e);
                    if(W > 0 and (e <= Vm[xV + 1])) or (W <= 0 and (e >= (Vm)[xV + 1])) then
                      Vm[xV + 3] = e;
                      w = z[0x6][w];
                      end;
                    else
                    if not ((C >= 0x15)) then
                      Vm[(z[0x7])[w]] = Vm[z[0X6][w]][G(w)];
                      else
                      Vm[(z[7.0])[w]] = (d(w)) + (G(w));
                      end;
                    end;
                  end;
                end;
              end;
            if T.w((cN[0x1])[0b110001], 33618) == 2 then
              else
              Vm[27] = Vm[(z[0X7])[w]] % Vm[(z)[0xb][w]];
              end;
            if((T.w((cN[0b1])[0x31], (C > C and b - C or 33371)) * 631 + 316) % 55645) < 316 then
              (cN[1.0])[0X39]("bad argument");
              else
              do
                local s = T.w(((cN)[1.0])[0B110001], 34035);
                end;
              end;
            if Vm[z[6.0][w] or 0] == (Vm)[(z)[6.0][w] or 0] then
              if T.w((cN[1])[0X31], 17826) <= 137 then
                else
                break;
                end;
              else
              cN[0x1][57.0]("bad argument");
              end;
            if T.w((cN[0X1])[49], 222) ~= 186 then
              Vm[(z[0x6])[w]] = 110 * Vm[(z[0x7])[w]];
              end;
            if((T.w(cN[0x1][0b110001], (b > b and w - b or 8933)) * 995 + 907) % 37718) >= 463 then
              do
                local I = T.w((cN[0B1])[0b110001], 16935);
                end;
              end;
            w = (w + 1);
            end;
          end;
        end);
      if not i then
        if N then
          for Qn,Z,f in N do
            if Qn >= 1 then
              (Z)[2] = (Z);
              (Z)[3] = (Vm[Qn]);
              (Z)[1] = 3;
              N[Qn] = nil;
              end;
            end;
          end;
        if cN[0X1][16](D) ~= "string" then
          cN[0x1][57](D, 0);
          else
          if not (cN[0x1][0b11111](D, ":(d+)[:\r\n]")) then
            cN[0x1][57.0](D, 0);
            else
            (cN[0B1])[0x39]("Lightray error:" .. (z[4.0][w] or "(unknown)") .. ": " .. (cN[1.0])[0x1b](D), 0);
            end;
          end;
        elseif D then
        if mX ~= 0 then
          return Vm[x]((cN[0B1])[4](T, cN, Vm, mX, x + 1));
          else
          return (Vm)[x]();
          end;
        else
        if x ~= nil then
          return (cN[0X1])[0B100](T, cN, Vm, mX, x);
          else
          return;
          end;
        end;
      end;
    else
    z[0x3], (z)[0b100], z[0X5], (z)[6], z[0x7], z[0x8], z[9.0], (z)[0xa], z[11.0], z[0xc], z[0xd], z[0xe] = ((z[0x1])[6]), z[0x1][11], ((z[0X1_])[3]), (z[0X1][4]), (z[0B1])[5], z[0x1][8], z[0X1][9], z[1][7], (z)[1.0][10], (z[1])[12], (z[0B1][13]), (z[0X1][14]);
    z[0xf], z[0x10], z[17.0] = z[1][17], (z[1.0][18]), ((z[0x1])[19]);
    end;
  end,zD = function(T, T, d)
  return ((((((T - d[0X6]) + (d)[12.0]) + d[0x1]) - (d)[3]) + d[1.0]));
  end,J = getfenv,cZ = function(T, Y, h, W)
  if not (h < 0x225) then
    if not (h < 0b10111010_01) then
      if(h >= 0b1110101101) then
        (Y[1])[0x18], (Y)[0X1][0B11001] = nil;
        elseif h >= 843 and (h < 0X3AD) then
        W[0x8] = W[6.0][W[7.0]];
        (Y[0x1])[0X20] = nil;
        else
        (Y[1])[0xb] = nil;
        W[0X7] = Y[1][0X9](T, Y);
        end;
      else
      if not (h < 647.0) then
        if(Y[0B1])[0x18] then
          (Y[0X1])[0b101](T, Y, (W)[0B110]);
          end;
        else
        for Zv =1, (# (Y[1.0])[0x20]), 3 do
          (Y[0x1])[0x20][Zv][Y[0b1][0X20][Zv + 1]] = (W[0X6])[((Y[0x1])[32.0])[Zv + 2]];
          end;
        end;
      end;
    else
    if h >= 0XFF then
      if not (h < 0X1C3) then
        for Ku =1, W[0x5] do
          W[0x6][Ku] = (Y[0x1])[0x1e](T, Y);
          end;
        else
        if h >= 0B101100001 and (h < 0X1C3) then
          (W)[0b101] = ((Y)[1])[0x9](T, Y) - 8;
          W[0b110] = Y[0b1][0X34](T, Y, W[5]);
          ((Y)[0x1])[0B100000] = ((Y)[0X1])[0x34](T, Y, W[0B101] * 3);
          else
          for g =1, W[0X1] do
            (Y)[0x1][0b10](T, Y, g);
            end;
          end;
        end;
      else
      if not (h < 157.0) then
        (Y[0X1])[0x18] = (Y[0X1])[0b111110](T, Y) ~= 0;
        else
        if(not (not (h ~= 0X3B))) then
          else
          (Y[0X1])[25.0] = {};
          W[0X1] = (Y[0b1])[0X9](T, Y) - 10;
          Y[0x1][0xb] = (Y[1])[0B110100](T, Y, W[0X1_]);
          end;
        end;
      end;
    end;
  end,If = function(T, S, e, H, R)
  (e)[12][H] = true;
  (e[5])[H] = ((S[1])[11])[R];
  end,eE = function(T, T, a)
  return a[0x8];
  end,Q = function(T, i, B)
  return (B * 21 + 10) % 64;
  end,Ax = function(T, T, B)
  return B[1];
  end,aP = function(T, x, Yn, h, Y)
  local k,p,Js,Nr,dT,S,j,C,lK,Hy,iL,X,J,U,n;
  local y = 0X8E3;
  while true do
    if y <= 12035.0 then
      if y < 10715.0 then
        if not (y >= 0x2095) then
          if y == 0X8E3 then
            k = x[0X1][0B111](T, x);
            y = T:iU(0x0, T.sR);
            T.nK[0x1c5] = (y);
            end;
          else
          if y >= 0x2095 and (y <= 8341.0) then
            p = k % 8;
            Js = (x[0x1])[0X7](T, x);
            (T.nK)[37.0] = (- 0x5b309db5 + T:zD(y, T.sR, y));
            y = T.nK[37.0];
            else
            Nr = Js % 8;
            y = (- 0x2f53729e + ((T.sR[0X4] == T.sR[0b1011] and T.sR[5.0] or T.sR[0X1]) ~= T.sR[11] and T.sR[0xc] or T.sR[0x6]));
            T.nK[0X148] = (y);
            end;
          end;
        else
        if not (y > 10779.0) then
          if y >= 0B10100_111011011 and (y < 0x2a1b) then
            if not (y ~= 0x29db) then
              dT = T:dM(x);
              S = (Js - Nr) / 8;
              end;
            y = 0b10110_0111 + T:zQ(0x0, T.sR);
            (T.nK)[0x89] = y;
            else
            if not (y == 10779) then
              else
              j = (x[0x1])[0B111](T, x);
              C = (k - p) / 8;
              end;
            y = (- 1673185727 + ((T.sR[0xe] == T.sR[9.0] and T.sR[0X8] or T.sR[0b100]) ~= T.sR[4] and T.sR[14] or T.sR[0xb]));
            (T.nK)[0x19d] = (y);
            end;
          elseif y >= 10866.0 and (y <= 10866.0) then
          if not (y ~= 0X2A72) then
            lK = dT % 8;
            end;
          y = (- 0XF16FC1C + ((T.sR[9] == T.sR[0X2] and T.sR[0B101] or T.sR[0x4]) ~= T.sR[11.0] and T.sR[0x7] or T.sR[0b1]));
          T.nK[0b100010100] = y;
          else
          Hy = (dT - lK) / 8;
          Yn[10][h] = C;
          y = (- 5497825064 + (((((T.sR[0X1] + T.sR[9.0]) - y) + T.sR[0B1011]) - T.sR[0x7]) + T.sR[0X7_]));
          (T.nK)[0X8E] = y;
          end;
        end;
      else
      if y <= 0X4A92 then
        if y <= 0x3e78 then
          if y >= 0x3ad2 and (y <= 0X3AD2) then
            Yn[4][h] = Hy;
            (T.nK)[337] = (- 3981737141 + (((((T.sR[0XC] + T.sR[0X9]) - y) + T.sR[0xd]) - T.sR[0X1]) + T.sR[0X1]));
            y = T.nK[337];
            else
            Yn[5][h] = S;
            (T.nK)[107.0] = ((- 0x4684a5c0 + ((T.sR[0XD] == T.sR[0xd] and T.sR[0xd] or T.sR[0b1010]) ~= T.sR[0X3] and T.sR[13.0] or T.sR[0x2])));
            y = (T.nK)[107.0];
            end;
          elseif y == 16745.0 then
          if not (y ~= 16745.0) then
            Yn[3][h] = j;
            end;
          T.nK[0X17F] = ((- 1921930746 + ((T.sR[0B110] == T.sR[4] and T.sR[8.0] or T.sR[0x6]) ~= T.sR[3] and T.sR[0b1110] or T.sR[3])));
          y = (T.nK)[0X17F];
          else
          iL = 0;
          X = 7;
          T.nK[0b11000010] = ((- 0X63BAA390 + ((T.sR[0b1010] == T.sR[0b1] and T.sR[8.0] or T.sR[11.0]) ~= T.sR[10] and T.sR[0XB] or T.sR[0X9])));
          y = T.nK[0b11000010];
          end;
        else
        if not (y > 0x5504) then
          if y >= 0x50a1 and (y <= 0b1010000_10100001) then
            J = 1;
            U = 4;
            y = (- 0X777C1D59 + ((T.sR[13.0] == T.sR[0x4] and T.sR[0X7] or T.sR[0b1011]) ~= T.sR[0X1] and T.sR[9] or T.sR[0x5]));
            (T.nK)[0xda] = y;
            else
            if not (y == 0B101010100000100) then
              else
              n = 2;
              if lK == iL then
                x[0x1][8.0](T, x, Yn, h, Hy);
                elseif lK == X then
                Yn[4][h] = Hy;
                else
                if lK == J then
                  (Yn[4])[h] = h + Hy;
                  else
                  if lK == U then
                    Yn[4][h] = h - Hy;
                    end;
                  end;
                end;
              end;
            y = (- 0x28740eac + ((T.sR[0xc] == T.sR[0xd] and T.sR[1] or T.sR[0b110]) ~= T.sR[0B1000] and T.sR[0x2] or T.sR[0x6]));
            T.nK[170.0] = (y);
            end;
          elseif y >= 0x5880 and (y <= 0x5880) then
          if p == iL then
            x[0x1][0x2d](T, x, Yn, h, C);
            else
            if p == X then
              Yn[10][h] = C;
              else
              if p == J then
                Yn[10][h] = h + C;
                else
                if p == U then
                  (Yn[10])[h] = (h - C);
                  else
                  if p == n then
                    x[1.0][0X2F](T, x, Yn, h, C, Y);
                    end;
                  end;
                end;
              end;
            end;
          y = (- 0X63BA97F3 + ((T.sR[0xe] == T.sR[0B100] and T.sR[0x9] or T.sR[7.0]) ~= T.sR[8.0] and T.sR[0b1011] or T.sR[0x7]));
          T.nK[0x14a] = (y);
          else
          if not (y ~= 0b101110000111_110) then
            if Nr == iL then
              (x[0b1])[0x24](T, x, Yn, h, S);
              else
              if Nr == X then
                Yn[5][h] = S;
                elseif Nr == J then
                Yn[5][h] = (h + S);
                else
                if Nr == U then
                  Yn[5][h] = h - S;
                  end;
                end;
              end;
            end;
          break;
          end;
        end;
      end;
    end;
  end,g = function(T, w)
  local Mz = {};
  for Gl =0X42, 0X42, 0B1100001_ do
    T:xK(w, Gl, Mz);
    end;
  return T.z(T:B(w, Mz));
  end,kV = function(T, M, kJ, N)
  if not (kJ < 82) then
    repeat
      (N)[0x3] = T.w((M[0x1])[0X31], M[0x1][0x21] - 1);
      N[0x1] = (N[1.0] + (((N[0X3] > 127 and N[0X3] - 128 or N[0X3]) * N[0x2])));
      N[2.0] = (N[0x2] * 128);
      (M[0B1])[0x21] = ((M[0X1])[0X21] + 1);
      until N[3.0] < 128;
    else
    N[0b1], N[0x2] = 0, 1;
    end;
  end,Zw = function(T, m, Gb)
  if m >= 70.0 then
    (Gb[0x1])[0B100] = T.lY;
    else
    if not (m < 70) then
      else
      ((Gb)[0B1])[0x1f] = (T.Hw);
      end;
    end;
  end,c = type,vN = function(T, x, Ch)
  if not ((x < 0x66)) then
    (Ch[0x1])[0X8] = (T.Xr);
    else
    if not (x < 0X66) then
      else
      ((Ch)[0x1])[0b100100] = T.If;
      end;
    end;
  end,On = function(T, x, uN)
  if x >= 0X113 then
    if x >= 0x1eb then
      (uN[0b1])[0X1A] = (T.aP);
      else
      if x >= 0X17F then
        uN[0B1][0X28] = (T.h);
        else
        (uN[0x1])[0B111000_] = T.aC;
        end;
      end;
    else
    if(x >= 0XA7) then
      ((uN)[0B1])[0x5] = T.yA;
      elseif not (x == 59.0) then
      else
      ((uN)[0X1])[0b110] = (T.M);
      end;
    end;
  end,qE = function(T, T, L)
  return { (T[0X1])[23.0](L[0X1], L[3], L[0B10]),};
  end,yA = function(T, T, F)
  T[1][10.0][3] = (T[0x1])[0xb];
  ((T[0x1])[10.0])[1] = F;
  end,pH = function(T, w, W, uA, h, B, i, x, Qu, X)
  local p;
  for sN =0B10001011, 336.0, 197 do
    if sN >= 0X150 then
      if(p and ((((uA * 21)) % 7) < 1)) and (x < Qu) then
        local E = w[0x1][20.0](T, w, uA);
        X[uA] = w[1.0][0b100101](T, w, (X)[uA], E) + 128;
        i[5][uA] = (w[0x1])[37.0](T, w, i[5][uA] or 0, E);
        (i)[4][uA] = (w[0B1])[0x25](T, w, (i)[4][uA] or 0, E);
        (i[10])[uA] = (w[0X1])[0X25](T, w, (i[10])[uA] or 0, E);
        x = x + 1;
        end;
      elseif(not (sN < 336.0)) then
      else
      if(W)[uA] then
        local E = h[uA];
        if(w[0B1])[16.0](E) == "number" and (E > 0) then
          B = E;
          end;
        end;
      p = ((((((not (i[12])[uA] and not i[13][uA]) and not i[14][uA]) and (w[0b1][16](i[4][uA]) ~= "string")) and ((w[0X1])[0B10000]((i[10])[uA]) ~= "string")) and (w[0x1][16](i[4][uA]) ~= "number" or ((i)[4][uA] % 1) == 0)) and ((w[1.0])[0B10000](i[10][uA]) ~= "number" or (i[10])[uA] % 1 == 0));
      end;
    end;
  end,tG = function(T, z, Z, e)
  if not (Z < 0B1010010000) then
    if Z >= 950 then
      if Z >= 0b10001001001 then
        if Z >= 1244.0 then
          if e[0x2f] > 0 then
            z[0X1][55](T, z, e[0B101111], e[0x2]);
            end;
          else
          if not (Z < 0x4ab) then
            e[0B101111] = z[0X1][9.0](T, z);
            else
            if not (Z < 1146.0) then
              if e[45] > 0 then
                z[0x1][0b100010](T, z, e[0X2D], e[0x2]);
                end;
              else
              e[45] = T:Vy(z);
              end;
            end;
          end;
        elseif not (Z < 0B10000011000) then
        if e[0b1010_01] > 0 then
          z[1.0][58.0](T, z, e[0x29], e[0b10]);
          end;
        else
        if Z >= 0x3e7 then
          e[0x2][1] = T:Vy(z);
          e[0X29] = (z[0b1])[9.0](T, z);
          else
          for bU =1, z[0x1][0B101110](T, z) do
            z[0x1][0b100011](T, z, e[0xa_], e[0x3]);
            end;
          end;
        end;
      else
      if not (Z < 0b1100100011) then
        if not (Z < 0b1110000101) then
          e[0X2][6] = z[1][0x9](T, z);
          e[0x2][11] = e[10];
          else
          if not (Z < 852) then
            for Qi =1, e[8] do
              if e[0x22] > 0 then
                e[0b100010] = e[0X22] - 1;
                elseif not e[0X1E][Qi] then
                (z[0X1])[22](T, z, e[9.0], Qi, e[28], e[0x22], e[0X2], e[0X20], e[0x21], e[0X1B]);
                end;
              end;
            else
            e[0X22] = 0;
            end;
          end;
        elseif Z >= 754.0 and (Z < 0x323) then
        if e[33] < 1 then
          e[0x21] = 1;
          end;
        else
        if Z >= 0x2c1 then
          e[0X20] = 0;
          e[33] = (e[0X8] * 0.15 - ((e[8] * 0.15) % 0B1));
          else
          for n =1, e[0X8] do
            if e[0x1d][e[0b11011][n]] then
              (z[1])[0XE](T, z, e[28.0], n, e[0x1e]);
              end;
            end;
          end;
        end;
      end;
    else
    if Z >= 0x139 then
      if not (Z < 460) then
        if Z > 606.0 then
          e[0x1e] = {};
          else
          if Z >= 0x22e then
            for C,Sw in T.S({ 25,19,9,}) do
              e[0X1D][Sw] = true;
              end;
            elseif Z >= 0x1fd then
            e[29] = {};
            else
            e[0X1B] = e[0x2][3];
            e[28] = e[2.0][4];
            end;
          end;
        else
        if Z >= 411.0 then
          for s =1, e[0x8] do
            z[0B1][26.0](T, z, e[0b10], s, e[9.0]);
            end;
          else
          if not (Z < 0X16A) then
            e[0xa] = {};
            else
            e[2.0][13] = (z[0x1])[0b110100](T, z, e[0x8]);
            e[0X2][14] = z[1.0][0X34](T, z, e[0x8]);
            e[9] = {};
            end;
          end;
        end;
      elseif Z >= 0xa6 then
      if not (Z < 0B100001000) then
        e[0X2][8] = z[0x1][52](T, z, e[0x8]);
        e[0x2][9] = nil;
        e[0B10][10] = (z[1.0])[52](T, z, e[0B1000]);
        e[2.0][12] = (z[0X1])[0x34](T, z, e[0X8]);
        elseif Z >= 215.0 then
        e[2.0][5] = z[0B1][0x34](T, z, e[0X8]);
        e[0b10][7] = z[0B1][0x34](T, z, e[8.0]);
        else
        e[8.0] = z[0x1][9.0](T, z) - 32;
        e[0X2][2] = e[0x4];
        e[2.0][3] = z[0X1][52.0](T, z, e[0X8]);
        e[0X2][4] = (z[0X1])[0x34](T, z, e[0x8]);
        end;
      elseif not (Z < 0x75) then
      for yO =1, e[0X1] do
        z[0X1][0x32](T, z, e[4], yO);
        end;
      elseif Z >= 0B1000100 then
      e[0b100] = z[1][52.0](T, z, e[1.0]);
      else
      e[0X1] = z[1.0][0X9](T, z);
      e[0X2] = {};
      e[0x3] = 1;
      end;
    end;
  end,h = pcall,Ta = function(T, w, Tt, p)
  local r = {};
  for e =1, Tt do
    local K = (w[1.0])[0X9](T, w);
    r[K] = T:Vy(w);
    end;
  p[20] = r;
  end,Vl = function(T, Z, gH)
  if(not (Z < 0XC2)) then
    if not (Z < 0x14e) then
      (gH[1])[0B101001] = (T.Su);
      else
      if not (Z < 264.0) then
        (gH[0x1])[52] = (T.lU);
        else
        ((gH)[0X1])[0X32] = T.Ue;
        end;
      end;
    elseif Z >= 124.0 and (Z < 0B11000010) then
    (gH[0b1])[14.0] = T.Rz;
    elseif(not (not ((Z ~= 54.0)))) then
    else
    gH[0B1][55.0] = T.Ta;
    end;
  end,e = function(T, r)
  local gZ = {};
  for dR =22.0, 99.0, 0b1001101 do
    T:Yq(r, dR, gZ);
    end;
  return { T.z(T:dL(r, gZ)),};
  end,Tf = error,sR = { 1820011119,0x2874672c,1666003396,0X1F2A946A,0X4C6DB263,0x49cc1fb8,0xf172b1f,1462715120,0x777c725d,1469468290,0x63baf431,0x2f539c79,0X4684E729,0x728ea08c,},dM = function(T, q)
  return (q[0B1])[9.0](T, q);
  end,Py = function(T, S, b)
  return T.r((- 0X376FADDA + (((((T.sR[0x7] + T.sR[0x4]) - T.sR[0B11]) + T.sR[0x1]) - T.sR[0B11]) + (T.sR)[0x3])), (0x0));
  end,uZ = function(T, T, Oc)
  return Oc[0x14];
  end,Vq = function(T, s, N)
  local Z = s[0X1][9](T, s);
  local U = T.b(Z);
  for A =1, Z do
    T.R(U, (A - 1), ((s[1.0][62](T, s) - 83) + 256) % 256);
    end;
  ((s[0x1])[11])[N] = T.F(U);
  end,Hw = string.match,mM = function(T, x, Xc, g)
  local B,k;
  local Z = 0x930;
  while true do
    if not (Z >= 0x2095) then
      if not (Z < 0x2095) then
        else
        B = (x[1.0])[46](T, x);
        (T.nK)[32.0] = (- 0x634d112f + ((T.sR[0X2] == T.sR[0b1001] and T.sR[0x7_] or T.sR[0xa]) ~= T.sR[0XA] and T.sR[0xe] or T.sR[3.0]));
        Z = T.nK[32.0];
        end;
      elseif Z >= 0X2095 and (Z <= 0X2095) then
      if not (not (Z ~= 0X2095)) then
        else
        k = (B / 2);
        if B % 2 == 0 then
          Xc[g] = k - (k % 1);
          else
          g = x[0X1][0x2e](T, x);
          local F = x[0x1][46](T, x);
          for q =k - (k % 1), g do
            Xc[q] = F;
            end;
          end;
        end;
      Z = (- 0X5B309DB5 + T:zD(Z, T.sR, Z));
      T.nK[0X1A4] = Z;
      else
      g = g + 1;
      break;
      end;
    end;
  end,Ow = "This file Was Protected By Lightrays",bV = function(T, e, L)
  return (((((e - L[0B1001]) + L[0X6]) + L[5]) - L[0B1100]) + L[5]);
  end,X = function(T, h)
  local e = {};
  for s =0B10011, 0b10011011100, 0B110001 do
    T:tG(h, s, e);
    end;
  return T.z(T:iJ(h, e));
  end,Cb = function(T, s, b)
  if not (s < 0XF9) then
    if s >= 0X1AF then
      b[1.0][0x2a] = (T.I);
      else
      if s >= 0b101010100 and (s < 0x1af) then
        (b)[0X1][48] = (T.Wm);
        else
        ((b)[0X1])[0x1d] = (T.O);
        end;
      end;
    else
    if s >= 0X9E then
      (b[1.0])[0B101100] = (T.hH);
      else
      (b[1])[0x36] = T.Y;
      end;
    end;
  end,Si = function(T, Rn, g)
  if Rn >= 232 then
    if Rn >= 412.0 then
      g[0x1][0X1E] = (T.X);
      else
      if Rn > 321.0 then
        (g[0x1])[46] = T.g;
        else
        (g[0X1])[0X9] = T.Vy;
        end;
      end;
    elseif Rn >= 142 and (Rn < 0XE8) then
    g[1][57] = (T.Tf);
    else
    if not (Rn == 0B110100) then
      else
      (g[1.0])[0x3] = (T.J);
      end;
    end;
  end,lY = function(T, z, pS, gP, P)
  local q = { pS,gP,P,};
  for Zk =0x29, 41.0, 0b100001 do
    T:Z(z, Zk, q);
    end;
  return T.z(T:qE(z, q));
  end,f = function(T, x, z, Z)
  local M = { z,Z,};
  for Ps =43, 0x8e, 0B11000_11 do
    T:fS(x, Ps, M);
    end;
  return (T):uZ(x, M);
  end,z = unpack or table.unpack,gJ = (bit32 or bit).band,zQ = function(T, Q, f)
  return T.r((- 3128708096 + (((((T.sR[0X2] + T.sR[0X3]) - T.sR[0b10]) + T.sR[8.0]) - T.sR[0X2]) + T.sR[2.0])), (0x0));
  end,Wy = function(T, f, Og)
  return T.r((- 0x92f270d3 + ((((((T.sR)[12.0] + T.sR[5]) - (T.sR)[12.0]) + T.sR[0xd]) - T.sR[0B1100]) + T.sR[0xc])), (0x0));
  end,V = function(T, ...)
  local sA = {};
  local aX = (T):dX(sA);
  aX[0x1][46] = T.g;
  (aX)[0X1][52] = T.lU;
  aX[0x1][0x38] = T.aC;
  aX[0X1][0x25] = T.v;
  aX[1][0X36] = T.Y;
  (aX)[0X1][20] = T.Q;
  aX[1][0B100] = T.lY;
  (aX[0x1])[0b110011] = T.f;
  aX[0B1][0B1001] = T.Vy;
  aX[1][0X7] = T.dM;
  (aX[0x1])[50.0] = T.Ue;
  aX[1.0][8.0] = T.Xr;
  aX[0X1][45.0] = T.Ud;
  aX[0X1][0B101111] = T.zN;
  (aX[0B1])[0X24] = T.If;
  aX[0B1][0XE] = T.Rz;
  aX[1][22.0] = T.pH;
  aX[1.0][55.0] = T.Ta;
  (aX[0B1])[0x22] = T.nF;
  (aX)[0X1][58.0] = T.gF;
  aX[0x1][0B100011] = T.mM;
  (aX[1.0])[0X1A] = T.aP;
  aX[1][0x3e] = T.L;
  ((aX)[0b1])[63.0] = T.Gk;
  ((aX)[0B1])[12.0] = T.t;
  aX[0b1][0B10] = T.Uy;
  aX[0X1][5.0] = T.yA;
  (aX[0x1])[0X1E] = T.X;
  ((aX)[0x1])[0X35] = T.o;
  aX[1.0][13.0] = T.o;
  (aX[0x1])[0X80] = T.u;
  aX[0b1][0x81] = T.P;
  (aX[0b1])[0b10000010] = T.Gk;
  aX[0x1][131.0] = T.L;
  aX[0x1][0B10000100] = T.g;
  (aX[1.0])[23.0] = unpack or table.unpack;
  (aX[0X1])[0X13] = (bit32 or bit).bxor;
  aX[0b1][0B1111] = tonumber;
  (aX[1])[38.0] = (bit32 or bit).band;
  (aX)[0b1][0X28] = pcall;
  ((aX)[1])[0B101001] = string.gsub;
  aX[0x1][0x2c] = string.char;
  (aX[0X1])[0b11101] = string.byte;
  aX[1.0][0x2a] = string.sub;
  (aX[0x1])[0x6] = select;
  (aX[0X1])[3] = getfenv;
  aX[1.0][48.0] = setfenv;
  aX[1.0][0x10] = type;
  aX[1][0B111001] = error;
  (aX)[0X1][0x1f] = string.match;
  (aX[0x1])[0x1b] = tostring;
  T:zR(aX);
  for a =30, 0B1000110, 0X28 do
    (T):Zw(a, aX);
    end;
  local I = coroutine;
  T.Kv = I.wrap;
  for q =0b11101, 0x66, 0x49 do
    T:vN(q, aX);
    end;
  T.S = ipairs;
  for Ry =0B100000, 109.0, 0X4D do
    T:Re(Ry, aX);
    end;
  T.x = setmetatable;
  (aX)[1.0][0x3b] = {};
  aX[0B1][28] = "This file Was Protected By Lightrays";
  (aX[0X1])[0b111101] = ((aX[0X1])[0B101000]);
  (aX[1.0])[10] = {};
  aX[0x1][0x15] = 2147483648;
  (aX[0x1])[0B100111] = {};
  aX[0B1][33] = 1;
  (aX[1.0])[0x3c] = "Lightray";
  (aX[0x1])[0x31] = T.E((function(Tb)
    Tb = (aX[0X1])[41](Tb, "z", "!!!!!");
    local Zi = {};
    for r =0, 255 do
      Zi[r] = (aX[1])[0x2c](r);
      end;
    return (aX[0b1])[0x29](Tb, ".....", T.x({}, { __index = function(r, Z)
      local K,Ee,e,Q,rF = ((aX)[0X1])[0x1d](Z, 1, 5);
      local Zt = (((((rF - 33) + (((Q - 33)) * 85)) + ((e - 33) * 7225)) + ((Ee - 33) * 614125)) + ((K - 33) * 52200625));
      K = (Zt % 256);
      Zt = ((Zt - K) / 256);
      Ee = (Zt % 256);
      Zt = (Zt - Ee) / 256;
      e = Zt % 256;
      Zt = (Zt - e) / 256;
      Q = Zt % 256;
      local nN = Zi[Q] .. Zi[e] .. Zi[Ee] .. Zi[K];
      r[Z] = nN;
      return nN;
      end,}));
    end)((aX[0X1])[0b101010]([=[LRAY.f`;'Tzz!rr<$!!!!U5Q^udz0L,^?z!:W2Tz!!"`=!rr<$!!!!`5Q^udz*'aZ0[)]l_z!!#,H"Tuc^^BF_J`OQ-Sa2Q.("1Q%V"Tuof])r$5z3'[WL\]25b"2MRc"Tu-H[KQcK_8c]]_mm_j"1l7V"Tu-N_$'qM]"nOP[)fZZ!PAL7z!!kgn!PJR8z!"_C!!P/@5z!*MPj!PSX9z!(9'U!P\d=^]e8H]=;q$]XPJ^F3;/3[r]!b`PoL"[r]!j_7-qnF0rcmF1K9,`lEXOT!Z#BF1/]j[_B8\F2to&F2,)ua10+)Irh=-bB(,/aMGp,[r\so^pV13F/?OcF2tr'[r]O*_mk7$%(=$g[C!u[^pq.h\,u^2z-9q_C[_fhf[)]Jk[)'>`!rr<$!!!!K5QqM1[(<oYZFRWe\-32S[(<oYZFmWU!rr<$!!!!T5QqP2[(<oYZGsr%`P;QUz!(&pQz!!"rC"UhcX[(45_`k]7-])r$5z4[9/X[`,Vaa0N.j_S-0\[`,Vaa0N(e[^uVAzJ3lL)$cg5nagf*k`PT!k!rr<$!!!!a5Q^ud!!!"L6pLn_a2PF-\A,>h\?l><zJ42^,$HL,magf*k`kKY!z!.[R)"UhfP[(jJhZH'i)_#jZ;!!!"L8jEOf\%K)__Rd%][(sQ]z!.[d/"UrP`[)]eg`NmIi]YO[MzJ5/?5%*H)ea1Jk#ZHBhr[fZU1!!!#7:d>0k\\,qoZGjJu\A\OMz^em?#$G!gh]<];^\?s'Sz!'jFI"UVuW_76e``PTFnz!5MMu"UVuW_76e^_S<P^z!5MQ!"U_i^]YCq]`O*Iq!rr<$!!#8b5QqM%`ONakZF@ob^B4H9!!!!a=?m$!\&cCs\AH(f[`-J.`rc;A!!!!a=[3,u[)f\r]Y_Lj[CisNz!5M`&"UN#Ua0Nk)^UXFHz^fiu,#fF0mZFdKd^&n?8!!!!a><i?"^r"1/a0N=o`Q#Ciz!'jdS"U`2h\AlRp^pLbj!rr<$!!'fA5QqM5aLK71ZGsPd\,u^2!!!",?pFl&^V[k.ZF7BT`lA/]z+CRM=$,=?oa0N1n_SZHUz?su;($GjWgZH9Vm\&-)dz!2*dd"UW#_[^*Kc[)KKVz!8q<O"Ui>a]YD4e`kSn#])r$5!!!"l@mC2)`kK+#^Tt8S`k)<Qz?t;M+$FRsc\[&iS`lGRkz!8qBQ"U_ZY\[f#Q`PB@0!rr<$!!&['5QqP?_SNaf\\c=q`lA/]z?tMY-$dHQ)\?`TR`jj".!rr<$!!&[(5QqP?_SNafa2l*+`O#^Izi+G:Y$I-H(\?a,s[(sQ]z!$Gr?"U2f_]YVVl#0+^&]YV/_"3/Ei!rr<$!!!!A5Q^udz,X;G3z!!#7dz!.\uQ!rr<$!!#8f5Q^ud!!!"L5X5JU[EQ\$!rr<$!/?.Z5m75l#fjg%a2P^-\ci8I^pU\k"U2HU_T'V""M1tT\-3&Ua25[&"U)lY\$uSF`l#1&^'+\[]<o&W"U2<K_SX(l"MD^j_$("R^U2##"U2rY_Ss=p#.D1\\%'B\"Mh[i`ruXW^U1ti"U2lX\%9'Q"Ne$c\-2o="Tbt4z!!$^u"Tc"7!O`.4[flfB"Tc.9z!!"E4!rr<$!!!!C5Q^udz/jKL=z!&?eC!P8F6z!#Rs'z!!!]u!rr<$!!!!u5Qq;+[)]c^"hDCb_SlTWz!(fEXz!'j@G!rr<$!!%OM5Q^ud!!!"L?9eYu_nsI,_SHBY`PTO&"UDfL_8j()_$'tL_SEP]z!.[^-"V/_p]YV10\%'5jJ;&Wi"U;?@['d<M!rr<$!!!!M5Q^udz2*_6Dz!&d(Ez!!##E!rr<$!!!![5Q^udz4$WlJz!'WXMz!!#;M!rr<$!!%O85Q^udz6U1_RzJ3uR(z!!#GQ!rr<$!!!!g5Q^ud!!!"L7R.%Uz!(T9Vz!!#PT!rr<$!!%O?5Q^ud!!!",Da4C)zJ4W!.z!!#k]!rr<$!!!!k5Q^ud!!!!a<BpWdz!),W[z!.\!5!rr<$!!'f95Q^ud!!!"L:d>*_z!)#QZz!!$%b!rr<$!!!!t5Q^ud!!!!a=$Qifz!)Po_z!'jLK!rr<$!!#8]5Q^ud!!!"L<Bse%!!EQ9&/5s$+=&?d0JkaO5X[@4%gW[N(Ea4n*sVfO-Qip)(J+qk#=f:/#>_9')X%E%:D=%8#9O1X0-;!+*un'@7htLu2a8>g%lYR8(K;%Q(CqSm(Ddhl#7hRY&c_n3#QOi)$31&+$31&+$31&+$31&+$ig8-$ig8-$ig8-$ig8-$ig8-$ig8-$ig8-$ig8-$ig8-$31&+&-)\1&-)\1"onW'!<<*"'*&.@$kO*i*$?LT/2/n?4?u;*1Ck!$$3peB)%Reo&I0Bg&I0B_%0m+M)$_5o*sWl(('b?d$3peB)%Reo&I0Bg&I0B_%0m+M)$_6"*sWl(('bod*sWl(('b'T('G9N!!!i9!!!i9!!!i9!!!i9!!!i9!!!i9!!!i9!!!i9!!!o;!!!o;!!!o;!!!o;!!!o;!!!o;!!!o;!!!o;!!!u=!!!u=!!!c7!!!*$!!!o;":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C5A3'r3p]h<7+!;(!-O0YW0-Cc1+,L")2\.#<#6tPQ%mL:2#<r_2#<rG&#6uCi#=fRP#>YjP:Hq>d#8]TH#=fRP#>]jU)@'=K+#d8&'GjO]*)Adh(^CjA*sWmP!>>\[(EWl((D[5\%i,Nk!!!!E!!!!G!!!!G!!!!G!!!!G!!!!I!!!!I!!!!I!!!!I!!!!I!!!!I!!!!I!!!!I!!!!I!!!!I!!!!K!!!!K!!!!K!!!!K!!!!K!!!!K!!!!K!!!!G!!!!O!!!!O!!!!C!!!!#!!!!F!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?t<qeE-->PJ,t<(L]NG8O9%cT%gN.@(Pi>-#9T$5%gOJL#S..nTEl&52lHum#=#Eu%gPV7#S./9^^(G]%n@hj!@J*V\-F*'*Zu7@'c.Ak'F,EZ!XBgg#S..fcj1-e0A$O@#<1QH%gP>_#S./1n-BO0:\Y2+#?QE^%hBIH+uh4\#.Omc0-25X-P[^>(DI*%%j)$0L^=Rs2]!P@5Ca"XkQFB\*Z%$W*'YMm(^D-!('b'T((2Dg!!"nW!!"nW!!"nW!!"nW!!"nW!!"nW!!"nW!!"nW!!"nW!!"nW!!"nW!!"nW!!"nW!!"nW!!"tY!!"tY!!"tY!!"tY!!"tY!!"tY!!"tY!!"tY!!"tY!!"tY!!"tY!!"tY!!"tY!!"tY!!#%[!!#%[!!#%[!!#%[!!#%[!!#%[!!#%[!!#%[!!"hU!!!$"!!!c7":,DI'Gqf4,Ub2t1cRT_6qC!J<&Vf&%gNFH#727Y%gN[O%hB6W%gNOK#8%gY%gO0]%i5ud%gW[N(Ea4n+34Zt#:B`u#;721#9P)q#<s"H(InuN#8]lP#7j$@#9PK1#9Oa(#9O`t#6tbT#o3L@!($Yc!($Yc!($Yc!($Yc!($Yc!($Yc!($Yc!($Yc!(6ee!(6ee!(Hqg!(Hqg!(Hqg!(Hqg!([(i!([(i!([(i!([(i!(Hqg!)*@m!)*@m!'gMa!!*'"!"Ju3#Rh7Y(`XYD-nI&//dM[m"U>8=)%RMg&I0*_&I0*W%0m+e)$^rg*tKFu*X<2t*sW#e*sW$U)$^r_*sWSu('b'T('G*I!!#su!!#su!!#su!!#su!!#su!!#su!!$%"!!$%"!!$%"!!$%"!!#su!!$1&!!$1&!!#ms!!!'#!!!o;":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C5A3'r+#6G,H#6G,Pa9N4\-O1^u0-Cc1++XG!#=fRP2b-@P#<t]`#<rG&#7"BL#<t-h#>Yj2+@f3B57^7/2a959#=f"@#>[9##<re,#@@uR?Pccg#<s1A#9Sm*'*fTi*sWl(('b'T((;)]!!$I.!!$O0!!$U2!!$U2!!$U2!!$U2!!$[4!!$[4!!$[4!!$[4!!$[4!!$a6!!$a6!!$a6!!$a6!!$g8!!$g8!!$g8!!$g8!!$m:!!$m:!!$g8!!$U2!!%0B!!%0B!!$C,!!!$"!!"DI":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C5A8#duFEi1`!JCK0!K7&@!L*VP!Ls0]+:e\a#6tPQ%i5H_#8[m_%i5H[#6uCi+:eti#6tPQ%i5H_#8[m_%i5H[#6u[q#9O0i#7hm`#6tPQ%i5H_#8[m_%i5H[#6u[q#:C$$%hC#p#6tPQ%i5H_#8[m_#8[US#6thY#8[UW#8\0l#9Oa$+?'f:#<rG45;+r"#:D/>-QaEE#R;FT#6tPQ%i5H_#8[m_#8\0l#6tbT#UfZQ!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0.$Z!0@0\!0@0\!0@0\!0@0\!0@0\!0@0\!0@0\!0@0\!0@0\!0@0\!0@0\!/pmX!!3-#!*oR-#Rh7Y(`XYD-nI&/3'9Go85)iZ=Bo6EBP_X0G^P#BKE6l0Muf"@PQ@-PS,o8`U]ICpX9#O+ZiRZ;]E,eK_u[p[bQ6&ke,e2&g]?=6j8nHFliHSVoE"^fquM<LKE?r2Muo(BPQI3RS-#>bU]RIrX9,U-Zi[`=]E5kM_ue!]bQ?,me,n8(g]HC8j9"NHliQYXI0UPn!XBeP!XC(X*tKG(+pTJ#!XC@h*tK_0+pTbD%gP$!%gP<A%keGX!s]&;)%T4B&I1f:&I1f2%0m-c";qG7+!3^;7hc2(-QbQK:D=pQ58=Df=!&Pt:C%2D#9.SgB*Lk-?PNfY(EZ^kB+tSXB*SZK#7UnC+W1Ml%iYal7iqt[:ELB[*ukMm#7UnCT`Z/;?Om`U(KVh(?T/])2d[X3?On(uB1E[ADbhGk?QU6m?O%#F#;I)=?S<-!04,eD?Uki<+"niD?V_bN-SH\L?On(uB1E44DbhGk?QU6m?O%#F#;I)=?S<-!04,eD?UkB/+"niD?V_bN-SH\L?On(\B1F$dDbh)a?QU6m?O%#F#;I)=?S<-!04,e+?Ul2F+"ni]?V_DD-SH\L?On(\B1F$dDbgWT?QU6m?O%#F#;I)=?S<-!04,e+?Ul2F+"ni]?V^r7-SH\L#D<6u#=g]p#=fRG#6tbT%p]/8!13`d!1Elf!1Elf!1Elf!1Elf!1Elf!1Elf!1Elf!1X#h!1j/j!2';l!2';l!2';l!2';l!2';l!2';l!29Gn!29Gn!29Gn!29Gn!2KSp!2KSp!2]_r!2]_r!2]_r!2]_r!2okt!2okt!2okt!2okt!2okt!2okt!2okt!2okt!2okt!2okt!2okt!3-#!!3-#!!3?/#!3?/#!3Q;%!3Q;%!3Q;%!3Q;%!3Q;%!3Q;%!3Q;%!3Q;%!3Q;%!3Q;%!3Q;%!3Q;%!3cG'!3cG'!3cG'!3cG'!3cG'!3cG'!3cG'!3cG'!3cG'!3cG'!3cG'!3cG'!3uS)!3uS)!3uS)!3uS)!3uS)!3uS)!3uS)!3uS)!3uS)!3uS)!3uS)!3uS)!42_+!42_+!42_+!42_+!42_+!42_+!42_+!42_+!42_+!42_+!42_+!42_+!2';l!4i.1!4i.1!1!Tb!!3-#!!rW.#Rh7Y(`XYI#6tJ8QjF"Z#pT]\TEuhK#H.qR#R@R?,7"Oa#pT]\^^24j#8\-\#7hRO#ljr*_>jQ9_>jQ9_>jQ9_>jQ9_>jQ9_>jQ9_>jQ9_>jQ9^]4?7z$NL;8$kO*i*$?LT.gIF,*tK_H'FuPr%0m+E)$_Mp%i6<8'd!Yk,6o:q*tKG8'F,]r('b'T('P'G!!(.A!!(.A!!(.A!!(.A!!(.A!!(.A!!(.A!!(4C!!(4C!!(4C!!((?!!!*$!!",A":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C5A8#duFEi0u#;6<(O9mQn'F-i-+.rp)584Vm#7UnC#oNt4#S4u_2a7L*-SH2>:Bqu?#u=>2%o3E>#6tPQ#>YU9cj<3<#"Ka_'aJ(N+0Z&Y?PF#X#7UnC#oNtT#S5Po='l/5(EX@sD[.Ao$#a_r%rV[^#6tPQ#B'kYi!F%7#%nG_'aG6c('b'T((MGe!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(LK!!(FI!!!$"!!!c7":,DI'Gqf4,Ub2t1cRT_6qC!J<&Ot/#9T$6-RTTU%i5<Q#727Y*sWA_*tJqg*sW5[#?_oL-O1`T#q%)7(EY"1*s[l6,6o:q)[@_q*sXG0*sX_I%hBa0*![Pr&I0Bo('bod&I0Bo('b'T('bTT!!(dS!!(dS!!(dS!!(dS!!(dS!!(dS!!(dS!!(dS!!(jU!!(jU!!(jU!!(jU!!(pW!!(pW!!(pW!!(pW!!(pW!!)!Y!!)!Y!!)-]!!)-]!!(^Q!!!*$!!"VO":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C5A8#duFEi1`!JCK0!K7&@!L*VP!Ls1`!Mfap!NZ=+!OMl&#9O0mkQ)bI'F53k!s]&;)%RMg&I0*_&J#Z_%0m+m)$_N"+6W_Q-PQgs-NaSY#oO6i#8%1W%hT$_#7UnC&K(fi#S..V(D[5l#9*mq#9W.9-RTT52\."o!B2qOciGdY*\ST_#R;_"%gO`m+6X"a0,,3=-QE@=%j1!9-RTTE+"%=9&*O$=#:C$(kQ*%Y'F53s$3peB)%Reo&I0Bg&I0B_%0m+M)$_5h%j)>G!@%gk(EWl((D[5\%i,C&!!!#e!!!#e!!!#e!!!#e!!!#e!!!#e!!!#e!!!#e!!!#e!!!#e!!!#e!!!#e!!!#e!!!#e!!!#e!!!#e!!!#e!!!#e!!!#g!!!#g!!!#g!!!#g!!!#g!!!#g!!!#g!!!#g!!!#g!!!#g!!!#g!!!#i!!!#i!!!#i!!!#i!!!#k!!!#k!!!#k!!!#k!!!#k!!!#k!!!#k!!!#k!!!#k!!!#k!!!#m!!!#m!!!#c!!!!#!!!!Z!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?t<qeE-->PJ,t<(L]NG8O9(RHQiW]XTE1hhVu`t#YQ;*3\,j5C^]D@Sa8sKcciMVsfE'b.huQsc%gN.@(Ea4n*sWkm-Qip)(I8?42[9E2!CndI7mDM*'gFY@!@.@G7kYoR5O\so5<%d4,<$,d,6o#Y'*f<Z%gO1!%gOK'#nI7o+:e]!JH6&^59LIA7gC+@:EU/Q5?S9t?On4`Dc[u&B5\Mt?XFKPD[.3dG7PcsGBX`+IpX96D]]s;B,;9f(M=fp5@bE4+,g46#9O3^#:CW)#;6<(#<*b9#:EX\#>YjP5>P&hkQ+IT'Mf5F$3peB)%T4B&I1f:&I1f2%0m+M)'DEk'aGgN*sX0('*fm$*sXG@*sX/8('b'T((`J+!!)uu!!!!"!!!!"!!!!"!!!!"!!!'$!!!'$!!!'$!!!'$!!!'$!!!'$!!!'$!!!'$!!!!"!!!3(!!!9*!!!9*!!!9*!!!9*!!!?,!!!?,!!!?,!!!?,!!!E.!!!E.!!!E.!!!E.!!!K0!!!K0!!!K0!!!K0!!!K0!!!K0!!!K0!!!?,!!!9*!!!]6!!!c8!!!c8!!!c8!!!c8!!!i:!!!i:!!!i:!!!i:!!!i:!!!i:!!!i:!!!i:!!!i:!!!i:!!!i:!!!c8!!!u>!!!u>!!!u>!!)os!!!$"!!!W3":,DI'Gqf4,Ub2t1cRT_6o"uP#S..N+:e\nJ-lel+!;(!%nR);!`(0JVufIb*[![;(!m8"-O0>P?Y:E&='l\D2a7L*0*`3s#;7/(%oa2I%gO0]%i5ud#7hRZ&c_n3,QRlF-34)H-34)H-34)H-34)H-ij;J-ij;J-ij;J-ij;J-ij;J-ij;J-ij;J-ij;J-ij;J-34)H/-,_N/-,_N+oqZDz4TGTj$kO*i*$?LT/2/n?4?u;*9Me\j>[V)UCiFK@I"26N!Jgc8!K[>H!LNnX!MBIh!N6%#!O)U3!Or0C!Pe`S!QY;c!RLks!S@G.!T4">!U'RN!Up+q#7%aD%gNX7#nI7W#6G,P+:e])%j)$0+:e]!=U><t+:e]I#9O1H+:e]A0aTdO<u''g?Y:E&Il@W<GCKfuDg)q'(N1N'5<KSa+(Q#i*s`A^-ccN'+>462#<*b9#:G?0#mWuA#7hqQ#7(Q9+:e]Ii;j5iB*]"QG9@D$Dg)ZrG9@D$Iio7,Dg;WoQN83>#EJnP!=f@$!?_mXT)g&F#EJmW#m[p?(E\D5f)\)N+O:)?!=/qN!RCcNVZGZU?PVH!^B)@U'u'dY!Oi(D[fNZ5B,(YaY5o^MNr`2n#B,7r'*i`;$6#!5GBXbJ$%HS5(O$Z8GAeQ<#9Rk+#=n+]'*fnL!YYed+!1_8(D[5\%i--J!!!!U!<<*V!<<*X!<<*Z!<<*Z!<<*Z!<<*Z!<<*\!<<*\!<<*\!<<*\!<<*^!<<*^!<<*^!<<*^!<<*^!<<*^!<<*\!<<*Z!<<*d!<<*f!<<*f!<<*f!<<*f!<<*h!<<*h!<<*h!<<*h!<<*j!<<*l!<<*l!<<*l!<<*l!<<*l!<<*n!<<*n!<<*n!<<*n!<<*n!<<*p!<<*p!<<*p!<<*p!<<*p!<<*p!<<*p!<<*p!<<*p!<<*n!<<*l!<<+!!<<+!!<<+!!<<+!!<<+!!<<+!!<<*h!<<*f!<<+'!<<+'!<<*T!<<*"!!!!I!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?t<qeE-->PJ,t<(L]NG8O9(RHQiW]X8-]Y1!='DH%gO0]+!;XI'F,uj+!;pY'F-96%gP$(*sY"Q%gOb]!=9!,#9QH3:D?T+(DR/k=!&Lp:C7=3#oO7T#8%2B%hT%J#7UnC&K(gT:EKf`=!(3K-OL(`#oO7T#8%2B%hT%J#7UnC&K(gT:EKfh=!%Z#X8rt>0,G]82i%eZO:!p*'G!DE,SrBU*!\\M*sY:`*sXGP('b'T((2Mj!!$I/!!$I/!!$I/!!$I/!!$I/!!$I/!!$O1!!$O1!!$O1!!$O1!!$U3!!$U3!!$[5!!$[5!!$a7!!$a7!!$a7!!$a7!!$a7!!$a7!!$a7!!$a7!!$g9!!$g9!!$g9!!$g9!!$g9!!$g9!!$g9!!$g9!!$O1!!$s=!!$s=!!$s=!!$s=!!$s=!!$s=!!$s=!!$s=!!$C-!!!$"!!"hU":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C5A8#duFEi1`!JCK0!K7&@!L*VP!Ls1`!Mfap!NZ=+!OMm;!PAHK!Q5#[!R(RD#7pS7%gNmn%gOHe!@JBo!s]&;)%Reo&I0Bg&I0B_%0m-S!Z;4bW!=6F#9P$%#:B`u#;6l8#<*G@(EY"E#:CW)-T;hV#<rFo57][T#6tPQ%ke/"#;6T"#;6;k#7"*D#=k]t)R'H:7hc2(#9P<p(DS<)(DR`V-QF3=7g0,&#oO7,#8%1o%hT%"#7UnC)&XPM-PZk60-:E(]E&lT2\-u859CsP7t:j`#>Z]h(Io8]7kZe<#7iI0-SH8N#8]$8#7(/.)$_5o*sWl(('b'T((<#"!!%6E!!%<G!!%BI!!%BI!!%BI!!%BI!!%BI!!%BI!!%BI!!%HK!!%HK!!%HK!!%HK!!%HK!!%HK!!%NM!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%TO!!%ZQ!!%ZQ!!%TO!!%fU!!%fU!!%fU!!%fU!!%fU!!%fU!!%fU!!%lW!!%lW!!%BI!!&#[!!&#[!!%0C!!!$"!!"PM":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C5A8#duFEi1`!JCK0!K7&@!L*VP!Ls1`!Mfap!NZ;q#7h(N#8\Kn#:B`W+<Ms:#:CW)#8`L(#mWBo+"oQ3'F-i-+!=','h:JQ'F.Dm+!=?T'F.](+!=Wd'N[e##R=Ei+34[g<tkmH59IrO?XFLS:KIf-%n?s3#727Y<sK<B<t>lJ<sK0>#8%gY=%<`*7opc<%o3N;#727Y<sK<B<t>lJ<sK0>#8%gY=&0;2:KJW.?OmlI='l[I%p'hX(RtO?#8[mm#8\0l#6tbT$nMAY!1!Wc!13ce!13ce!13ce!13ce!13ce!1Eog!1Eog!1Eog!1Eog!1Eog!1X&i!1X&i!1X&i!1X&i!1X&i!1j2k!1j2k!1j2k!1j2k!1j2k!2'>m!2'>m!2'>m!2'>m!2'>m!2'>m!2'>m!2'>m!29Jo!29Jo!29Jo!29Jo!29Jo!29Jo!29Jo!29Jo!2KVq!2KVq!2KVq!13ce!2onu!2onu!0dKa!!*'"!&=NW#Rh7Y(`XYD-nI&/3'9Go85)iZ=Bo6EBP_X0G^P#BKE6l0Muf"@PQ@-PS,o8`U]ICpX9#O+ZiRZ;]E,eK_uWa@(C'sH%i5BS#727Y*sWA_*tJqg*sW5[#8%gY*s`A^*u>[u%hAaI#727Y*sWA_*tJqg*sW5[#8nBa*sWl1+!21%*u>\'%j1rZ#727Y*sWA_*tJqg*sW5[#8nBa*sWl(+!21%*u>\80,FmI-P$D/+!;:'-\r*JO:!?_'F-95*u?:@*%*B]#R<9n+"'!+'F-i-+!='$'h:JQ'F.,m#7!a(%0m+M)$`Yj*sY##+#d7c#VStT##@`J'aI5F('b'T((2kt!!'5(!!';*!!';*!!';*!!';*!!';*!!';*!!';*!!';*!!'A,!!'A,!!'A,!!'A,!!'A,!!'A,!!'A,!!'A,!!'A,!!'G.!!'G.!!'G.!!'G.!!'G.!!'G.!!'G.!!'G.!!'G.!!'M0!!'M0!!'M0!!'S2!!'S2!!'S2!!'S2!!'Y4!!'_6!!'_6!!'e8!!'e8!!'e8!!'k:!!'k:!!'k:!!'k:!!'k:!!'q<!!'q<!!'q<!!'q<!!'/&!!!'#!!!u=":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C5A8#dA#6tJ8#7hpf#8\3f#9P'!#7i6iciH'Q#2fMP-Q^>65=YoB0/j.i#:C`$%l=q)%gW[N(C1NV+2A*l#:CW)#8]*$#<rG4#=f"@^^!Xg,SrZe*'Z@m'aG7.*sWTE'*f>0$6#!5(Ddbj*tKFu(DdJb#7hRW)uos=bQ.\Dc2dnFc2dnFc2dnFc2dnFciF+HciF+HciF+HciF+HciF+Hc2dnFe,]OLec>aNec>aNec>aNec>aNfDtsPfDtsPfDtsPfDtsPfDtsPfDtsPec>aNg]7BTg]7BTg]7BTg]7BTaoMJBz.f]\X$kO*i*$?LT/2/n?4?u;*9Me\j>[V)UCiFK@I"26N!Jgc8!K[>H!LNnX!MBIh!N6#l#9O0m%j)#c#6tPQ#9O3^#:B`q-Pmj>#:C$(%jqSk#6tPQ#:CW)#<rG4p^&lD*[!*p'e^XV"r@f;$47"C#oO7$#8%1g%hT$o#7UnC&K)uE(C16^-QgD70-;5@%ke(k#727Y-O14g-P$do-O1(c#<<YD0,G?.57\\<7i**\58P<<!]N=b2^^6n#:C<'a9OX?"s5KW#R<j9)[ASt!C%qb'aH*&('b'T('uJk!!)?d!!)?d!!)?d!!)?d!!)?d!!)?d!!)Ef!!)Ef!!)Ef!!)Ef!!)Ef!!)Ef!!)Ef!!)Ef!!)Kh!!)Kh!!)Kh!!)Kh!!)Kh!!)Kh!!)Kh!!)Kh!!)Qj!!)Qj!!)Qj!!)Qj!!)Qj!!)Qj!!)Qj!!)Wl!!)Wl!!)Wl!!)Wl!!)Wl!!)Wl!!)Wl!!)cp!!)cp!!)cp!!)cp!!)cp!!)cp!!)9b!!!'#!!!T2":,DI'Gqf4,Ub2t1cRT_0a@ph%gNUf%gNmU)[@H-%gNV2#mWC")^dR''F-iM*sYRH)^e-O#T#EA*&fMU'aFss*sW<M'*f$Q*sW;m('b'T(((WR!!!!#!!!'%!!!'%!!!'%!!!'%!!!-'!!!-'!!!-'!!!-'!!!-'!!!-'!!!-'!!!-'!!!'%!!!9+!!!9+!!*!!z!!!i9":,DI'Gqf4,Ub2t1cRT_6qC!J<*3Bb#8[UH#9P'!#:C$(#;721#9R@\#=f"@#>^-^%gQ0d#T<qT2]ii;(E?L@7i8f<7iq^9#<*_0#6u1Q#<s;#(H3QD56hf++)DV-!?W*X#6tb]#6u%e#9O`t#8[UX#6tbT$lAsE!9=.\!9O:^!9O:^!9O:^!9O:^!9aF`!9aF`!9aF`!9aF`!9aF`!9aF`!9sRb!9sRb!9sRb!9sRb!9sRbz!9O:^!<*!!!<*!!!<*!!!<*!!z!9+"Z!!3-#!%n6S#Rh7Y(`XYD-nI&/3'9Go85)iZ=Bo6EBP_X0G^P#BKE6l0Muf"@PQ@-PS,o8`U]ICpX9#O+ZiNo,G6]''G7PYuIh*J7Ih*NKDg)p$LB/21(P`#%*/=Q-D\WM<!?W6sNr]b2Nr`U#'aL'+-Q<kg!=p0:!EWVC#G2#M)],+I%ih2B:KJ89VZA^q(T.9E*2`g-:DF,<!C%M>Y5o.RY5pjX'aM2K7iN8R!=p0Z!B34X#JU:8)]-6i%ii=b0/jUN`rT6\(WQOe*6/(-0,4`<!FHc^cN+OrcN,+8'aN=kB,_Z=!=p1%!>cgm#N#Q#)].B4%ijI-%i5rck5fcG(Ztf0*9R>-%i#<S(D[5\%i-0<!!!!S!WW3U!WW3U!WW3U!WW3U!WW3U!WW3U!WW3U!WW3U!WW3U!WW3U!WW3U!WW3U!WW3U!WW3W!WW3W!WW3U!WW3W!WW3W!WW3U!WW3W!WW3W!WW3U!WW3W!WW3W!WW3U!WW3Y!WW3Y!WW3U!WW3Y!WW3Y!WW3U!WW3Y!WW3Y!WW3U!WW3Y!WW3Y!WW3U!WW3Y!WW3Y!WW3U!WW3Y!WW3Y!WW3U!WW3U!WW3S!WW3#!!!!.!!EQ9&/5s$+=&?d0J*M?#S..V+:e]!#6>&W+:e\n+UJB<#9PT`586=@%i#<[2]i8@//&7)%j)#m(D[5\%i,E[!!!!_!WW3c!WW3c!WW3c!WW3c!WW3c!WW3c!WW3c!WW3c!WW3c!WW3e!WW3e!WW3_!WW3$!!!!.!!EQ9&/5s$+=&?d0J*MG#6G,P+:e])#6>&_+:e]!+UJBD#9Plp7hcIu7hn6)2^8PL//&71(EWl((D[5\%i,H\!!!!k!WW3o!WW3o!WW3o!WW3o!WW3o!WW3o!WW3o!WW3o!WW3o!WW3q!WW3q!WW3k!WW3%!!!!0!!EQ9&/5s$+=&?d0JkaB#7h%@#8[UG#9P'!#;721#:D/7#8\fq#<)l00/kg(#=f:*+?r@22\/+t#8]31#8[mm#8\0l#6tbT#nI"9!*0.$!*B:&!*B:&!*B:&!*B:&!*B:&!*B:&!*B:&!*B:&!*B:&!*B:&!*B:&!*TF(!*TF(!)s""!!*'"!#GV<#Rh7Y(`XYD-nI&/3'9Go85)iZ=>pI,#91_b+!21%(EX@s-O1UC!@K6/%j*/6#:C$$#;6l8#<*_H(FL:E#:B`c#7!O4#:C<0#;7/@#<)l,0/qMa,6p.4)^dSc!@%gs%hT$o(D[6'#8%1g(D[5\%i,Bd!!!"2!WW44!WW44!WW44!WW44!WW44!WW46!WW46!WW46!WW46!WW46!WW46!WW48!WW48!WW48!WW48!WW48!WW48!WW4:!WW4:!WW4>!WW4>!WW42!WW3%!!!!J!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?t<qeE-->PJ,t<(L]NG8O9(RHQiW]XTE.Uh(C(n@!Z)Xe#7hUc#9O0i%j-l7,6o:q)i+P;*u#8&*sMrt#9/a+-RTTU%i5<Q#727Y%gN[O%hB6W%gNOK#JgEY#8[UaO9-47'F,uj)i+PC-PR+6-O(Y'(C17!#9+1,O9-X3(C(n8!Z)Xe+:f8'#9O0i%j-T/,6o"i)s@;=(DO@a%i5rc*sW_q+6W_M#8[Uap]20I'[Qjk(DR/s#9+0qp]2TE#Fki5#6tbT"t9NP!-ePF!-ePF!-ePF!-ePF!-ePF!."\H!."\H!."\H!."\H!."\H!."\H!."\H!."\H!."\H!."\H!."\H!.4hJ!.4hJ!.4hJ!.4hJ!.4hJ!.4hJ!.4hJ!.4hJ!.FtL!.FtL!.FtL!.FtL!.FtL!.Y+N!.Y+N!.Y+N!.Y+N!.Y+N!.k7P!.k7P!.k7P!.k7P!.k7P!."\H!-SDD!!*'"!*K:)#Rh7Y(`XYD-nI&/3'9Go85)iZ=Bo6EBP_X0G^P#BKE6l0Muf"@PQ@-PS,o8`U]ICpX9#O+ZiRZ;]E,eK_u[p[bQ6&ke,e2&g]?=6j8nHFliHSVoE"^fquM<LKE?r2Muo(BPQI3RS-#>bU]RIrX9,U-Zi[`=]E5kM_ue!]bQ?,me,n8(g]HC8Gm=ic%gNmn%gOHe!@JBo!s]&;)%Reo&I0Bg&I0B_%0m.&";qFdW!=7)#9P$%#:B`u#;6l8(EX_=*tP"O!s]&;)%S)"&I0Zo&I0Zg%0m+])5mlQ*s2`Q#oO7$#8%1g%hT="#7UnC;&LGdkQCtm#727Y-O14g-P$do-O1(c#9ath$4e3\#6tPQ%jqSo#:C#o#:B`c#7'Jp)'C:;'aG6s*sXG(!A=s"!s]&;)%S)"&I0Zo&I0Zg%0m-+!Z;4jW!=7)#:Cl5#;6<(#<*G@(FL:E#9P<8*tP"O!s]&;)%SA*&I0s"&I0ro%0m+])5mlQ*s2`Q#oO7,#8%1o%hT=*#7UnC;&LGdkQCtm#727Y0*`'o0+SX"0*_pk#9ath$4e3\#6tPQ%ke/"#;6T"#:D/0#:B`c#6tPQ#6u+a+=@s?#8\a0#7&`[)$^BY)'C:C'aGO&*sW%H"W7Oe%j)#u(D[5\%i,CQ!!!"X!WW4\!WW4^!WW4^!WW4^!WW4^!WW4^!WW4^!WW4^!WW4`!WW4`!WW4`!WW4`!WW4`!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4b!WW4d!WW4d!WW4f!WW4f!WW4f!WW4f!WW4f!WW4f!WW4f!WW4h!WW4h!WW4h!WW4h!WW4h!WW4h!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4j!WW4l!WW4l!WW4f!WW4b!WW4r!WW4r!WW4^!WW5#!WW5#!WW4X!WW3$!!!"a!<<6.$kO*i*$?LT/2/n?4?u;*9Me\j>[V)UCiFK@I"26N!Jgc8!K[>H!LNnX!MBIh!N6%#!O)U3!Or0C!Pe`S!QY;c!RLks!S@G.!T4">!U'RN!Up-^!Vc]n!It6)!f-o:!g!JJ!gj%Z!h]Uj!iQ1%!jDa5!k8<E!l+lU!ltGe!mh"u!n[S0!oO.@!pB^P!q69`!r)ip!e:B+",I&<"-<VL".01\"/#al"/l='"0_m7"1SHG"2G#W"3:Sg"4./""5!_2"5j:B"6]jR"7QEb"8Dur"+UN-"Gd2>"HWbN"IK=^"J>mn"K2I)"L&$9"LnTI"Mb/Y"NU_i"OI:Z!=&i7)]&_i*!Zub)[@/a*sWmt$4d@ha9`@f%jr>%%hBTa(C)#e+1MXg#:IS!%hB0u*!Zub)[@/a*sWn'$4d@hcj:3n%jr>%%hBTa(C)#e+34d"#:J.1%hB0u*!Zub)[@/a*sWn7$4d@hi!Bo)%jr>%%i6/i([q_A*tK/-#9P$,#:G$/%i6<(*![i=)[A#=%gP$!%hC$0*![i=)[A#%%gP$9%hC$0*![iE)[A%K$4dXp(E<Z-#6G,`huO>n2p_jA#<s=A#=l9/%gPnW!=oE:3"H7$a9N4d-U/d[0/jgT2^][h0,GT5hZ5q\#Nl*m*uEf8(E<t;!T*nm(XE-6!>Pk&!Cn(6mfCK7%gVh0a9N4lk5cYEk5iU(cN+acmf?3'([hA8*:EpC!QP3U#PS7#)[HBDi!Bo1pAl'MpAq`(^B#&SrrHIG#DWB-#7h'#!n[_g(]OLX*<-&C!Oi(E#DW@&!J^`S!NuM=#EJq!)]+P:%igW3T)khj'aL',D]9LZ!Y69;!g`q[!>Pj3!d>RgVZPc`%i:i>(EB%KNrbRJ'aLW<IiB3%!Y69K!f$f;!>PjK!f$dqL]Y$e[fR8Z#Hn3<!X>h0Itn%>#JU=q!?:5'^B2.O'Ya]nIh`4/!fm@$#L<GV!XI<Y#6G.f![&!Yk5lb:&(^k!+p[!,#6G.n!mgrY#O_`P!=o^u!Z*$ck5kki#O_``#nI:8!ltTW&*F!1+p[Q<#6G/)!k8IG#QFk8#7h@6!Z*$kcN5I<(WQRn*6/,!G82cDD\Y3<B,(Zt!g`p,#M0$L!?2:$![f&pk5r^0%gU\f*ul*C!XB^k!`r_D#M0$D!?2:$!iH&<#Nl.9*s^[)(E=7C!XB^s!`)l4#N#Td!?2:,!k/1L(Z,91*8^ff:DF-'!l"aT#PS;`$4dsA!Z)g]k5t)R!TsMK7hl7n`rQ;J5K<dD#<s"?#6tbT0U2V<!4Dq/!4Dq/!4W(1!4W(1!4W(1!4W(1!4W(1!4i43!4i43!4i43!4i43!4i43!5&@5!5&@5!5&@5!5&@5!5&@5!58L7!58L7!58L7!58L7!58L7!5JX9!5JX9!5JX9!5JX9!5JX9!5\d;!5\d;!5\d;!5np=!5np=!5np=!6,'?!6,'?!6,'?!6,'?!6>3A!6>3A!6>3A!6>3A!6P?C!6P?C!6P?C!6bKE!6bKE!6bKE!6bKE!6bKE!6bKE!6bKE!6bKE!6bKE!6tWG!6tWG!6tWG!71cI!71cI!71cI!71cI!71cI!7V&M!7V&M!7V&M!7V&M!71cI!7h2O!7h2O!71cI!8%>Q!8%>Q!8%>Q!71cI!87JS!87JS!87JS!87JS!71cI!8IVU!71cI!8[bW!8[bW!71cI!8mnY!8mnY!71cI!9+%[!9+%[!9+%[!71cI!9=1]!9=1]!71cI!9O=_!9O=_!9O=_!71cI!9aIa!9aIa!71cI!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!9sUc!71cI!71cI!71cI!:Bmg!:Bmg!:Bmg!:Bmg!:Bmg!:Bmg!71cI!:U$i!:U$i!:U$i!:U$i!:U$i!71cI!:g0k!:g0k!:g0k!71cI!;$<m!;$<m!;$<m!;$<m!71cI!71cI!;6Ho!;6Ho!42e-z!&jl\#Rh7Y(`XYD-nI&/3'9Go85)iZ=Bo6EBP_X0G^P#BKE6l0Muf"@PQ@-PS,o8`U]ICpX9#O+ZiRZ;]E,eK_u[p[bQ6&ke,e2&<sKfQ%gOI)%gO`u*sX_I%gOKP!XTZE56_@"#6A1-<u'p%7o(2Q!FJ%q(KXrYfE4oN*_-`:$3peB)%TdR&I2AJ&I2AB%0m,P)+S<]'i/1L#R>PY)[D-!#9O23!ItFo#F>HU*uBt=(EAJ:Itn%A(O$Z8\,pSm*cG+e'aGg^*sW$"),Fle'h;VD#WQ`e*cG+e'aGg^*sYjP!XE'T%gQb:#nI8Z+:e]a+ULr*!I"a/!J^\G(!m#3LB/HG=*Gko?RuiqB+GpdDc\"sB,;P#?QU!f+($)p-i=#Z#:CT8#:C<'#6tbT'/omk!!!*$!!36&!!36&!!36&!!36&!!EB(!!EB(!!EB(!!EB(!!WN*!!WN*!!WN*!!iZ,!!iZ,!!iZ,!!iZ,!!iZ,!!iZ,!"&f.!"&f.!"&f.!"&f.!"&f.!"&f.!"&f.!"&f.!"&f.!"&f.!"&f.!"&f.!!iZ,!"K)2!"K)2!"K)2!"K)2!"K)2!"oA6!#,M8!#,M8!#,M8!#,M8!#>Y:!#>Y:!#>Y:!#>Y:!#,M8!#bq>!#bq>!#bq>!#bq>!#bq>!!36&!$24B!$24B!<*$"!!<3$!#Yb>#Rh7Y(`XYD-nI&/3'9Go85)iZ=Bo5o#T!^\p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gE;8<u''`7o(0r58P%>(I&uX%tFuo#6tPQ%mL:2#<r_2#<rG&#6thYVuf1"#R;/1*sWm0',N#,'aPm/'aGfs('b'T((1u[!!%HM!!%HM!!%NO!!%TQ!!%TQ!!%TQ!!%TQ!!%ZS!!%ZS!!%ZS!!%ZS!!%ZS!!%`U!!%`U!!%`U!!%`U!!%`U!!%`U!!%`U!!%`U!!%TQ!!%lY!!%lY!!%lY!!%BK!!!$"!!!l:":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C53@G[K(&/.I(ENet#S..^+:e])\-ENL0-Cc1+))$?<t>MF!`)l4ciQ^5*_/F2'aGO>*u>H<$47"C#oO7<#8%2*%hT%2#7UnC&K.MK58OS1(I&uH+*8/4-P$q7+"%d.*u>[t#7hRX)#sX:Ook[aOok[aPQLmcQ3.*eQ3.*eQ3.*eQ3.*eQid<gQid<gQid<gQid<gQid<gRKENiRKENiRKENiRKENiRKENiRKENiRKENiRKENiQ3.*eSc\rmSc\rmSc\rmO95I_!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TRj$Ps$_p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gJ+':KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i*.j+"%d.*u>[t#7hRX)#sX:V?6euV?6euVum#"WWN5$WWN5$WWN5$WWN5$X9/G&X9/G&X9/G&X9/G&X9/G&XoeY(XoeY(XoeY(XoeY(XoeY(XoeY(XoeY(XoeY(WWN5$Z3((,Z3((,Z3((,U]USs!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TRB$l9-`p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gKfW:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i*Fl+"%d.*u>[t#7hRX)#sX:\cVp4\cVp4]E8-6^&n?8^&n?8^&n?8^&n?8^]OQ:^]OQ:^]OQ:^]OQ:^]OQ:_?0c<_?0c<_?0c<_?0c<_?0c<_?0c<_?0c<_?0c<^&n?8`WH2@`WH2@`WH2@\,u^2!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TRJ$l9-`p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gJ+(:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i+"'+"%d.*u>[t#7hRX)#sX:c3"%Hc3"%HciX7JdK9ILdK9ILdK9ILdK9ILe,o[Ne,o[Ne,o[Ne,o[Ne,o[NecPmPecPmPecPmPecPmPecPmPecPmPecPmPecPmPdK9ILg&h<Tg&h<Tg&h<TbQ@hF!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TRZ$l9-`p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gL)]:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i+jG+"%d.*u>[t#7hRX)#sX:iWB/\iWB/\j9#A^joYS`joYS`joYS`joYS`kQ:ebkQ:ebkQ:ebkQ:ebkQ:ebl2q"dl2q"dl2q"dl2q"dl2q"dl2q"dl2q"dl2q"djoYS`mK3FhmK3FhmK3Fhhu`rZ!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TSe#o<g]p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gIgt:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i+R?+"%d.*u>[t#7hRX)#sX:p&b9pp&b9pp]CKrq?$]tq?$]tq?$]tq?$]tquZp!quZp!quZp!quZp!quZp!rW<-#rW<-#rW<-#rW<-#rW<-#rW<-#rW<-#rW<-#q?$]t!X&K'!X&K'!X&K'oE,'n!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TRB$Ps$_p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gKNO:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i%&G-PZk.(D[5\%i,Nj!!!!+"98E/"98E1"98E3"98E3"98E3"98E3"98E5"98E5"98E5"98E5"98E5"98E7"98E7"98E7"98E7"98E7"98E7"98E7"98E7"98E3"98E;"98E;"98E;"98E-"98E&!!!!:!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?oc"1(C(]M$P+$p#8[XV#9P'!#:I"d%gOa1%gO1j#rbor#(R+X<u''`7o(0r58P%>(I&uX%tFuo#6tPQ%mL:2#<r_2#<rG&#6thYVuf1"#R;/1*sWm0',N#,'t=Jj-PZk.(D[5\%i,Nj!!!!?"98EC"98EE"98EG"98EG"98EG"98EG"98EI"98EI"98EI"98EI"98EI"98EK"98EK"98EK"98EK"98EK"98EK"98EK"98EK"98EG"98EO"98EO"98EO"98EA"98E&!!!!:!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?oakg(C(]M$P+$p#8[XV#9P'!#:I"d%gOa1%gO1j#rbor#,hT!<u''`7o(0r58P%>(I&uX%tFuo#6tPQ%mL:2#<r_2#<rG&#6thYVuf1"#R;/1*sWm0',N#,(!m7/-PZk.(D[5\%i,Nj!!!!S"98EW"98EY"98E["98E["98E["98E["98E]"98E]"98E]"98E]"98E]"98E_"98E_"98E_"98E_"98E_"98E_"98E_"98E_"98E["98Ec"98Ec"98Ec"98EU"98E&!!!!:!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?ob.g(C(]M$P+$p#8[XV#9P'!#:I"d%gOa1%gO1j#rbor#'`pF(!m"P:EE"j(DR/k59C[PJ-lVg#727Y56hc*57\>256hW&#8%iP!^@J,#8]TH#9S%$(FK_.^]tr/'aGfs('b'T((1u[!!#Ik!!#Ik!!#Om!!#Uo!!#Uo!!#Uo!!#Uo!!#[q!!#[q!!#[q!!#[q!!#[q!!#as!!#as!!#as!!#as!!#as!!#as!!#as!!#as!!#Uo!!#n"!!#n"!!#n"!!#Ci!!!$"!!!l:":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C53N*9$#8R"A%i68l(C1NV+!;(!-b'Bl#;721#9RXd2cgLoO989[(!m"P:EE"j(DR/k59C[PJ-lVg#727Y56hc*57\>256hW&#8%iP!^@J,#8]TH#9S%$(FK_.Vue%g'aGfs('b'T((1u[!!$1*!!$1*!!$7,!!$=.!!$=.!!$=.!!$=.!!$C0!!$C0!!$C0!!$C0!!$C0!!$I2!!$I2!!$I2!!$I2!!$I2!!$I2!!$I2!!$I2!!$=.!!$U6!!$U6!!$U6!!$+(!!!$"!!!l:":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C53PYk9#8R"A%i68l(C1NV+!;(!-b'Bl#;721#9RXd2cgLoQjQVj(!m"P:EE"j(DR/k59C[PJ-lVg#727Y56hc*57\>256hW&#8%iP!^@J,#8]TH#9S%$(FK_.a9`q9'aGfs('b'T((1u[!!$m>!!$m>!!$s@!!%$B!!%$B!!%$B!!%$B!!%*D!!%*D!!%*D!!%*D!!%*D!!%0F!!%0F!!%0F!!%0F!!%0F!!%0F!!%0F!!%0F!!%$B!!%<J!!%<J!!%<J!!$g<!!!$"!!!l:":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C53LC0j#8R"A%i68l(C1NV+!;(!-b'Bl#;721#9RXd2cgLo^^!Y:(!m"P:EE"j(DR/k59C[PJ-lVg#727Y56hc*57\>256hW&#8%iP!^@J,#8]TH#9S%$(FK_.#TkE/#9O`t#6tbT$Q/pE!.k=R!.k=R!/(IT!/:UV!/:UV!/:UV!/:UV!/LaX!/LaX!/LaX!/LaX!/LaX!/^mZ!/^mZ!/^mZ!/^mZ!/^mZ!/^mZ!/^mZ!/^mZ!/:UV!0.0^!0.0^!0.0^!.Y1P!!*'"!#Yb>#Rh7Y(`XYD-nI&/3'9Go85)iZ=Bo5ocjLWp(&/.I(ENet#S..^+:e])\-ENL0-Cc1+))$?<t>N!!`)l4ciQ^5*_/F2'aGO>*u>H<$47"C#oO7<#8%2*%hT%2#7UnC&K.MK58OS1(I&uH+*8/4-P$q7+"%d.*u>[t#7hRX)#sX:Q370fQ370fQimBhRKNTjRKNTjRKNTjRKNTjS-/flS-/flS-/flS-/flS-/flScf#nScf#nScf#nScf#nScf#nScf#nScf#nScf#nRKNTjU'(GrU'(GrU'(GrPQUsd!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TSe!uD1Wp^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gLqn:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i*.j+"%d.*u>[t#7hRX)#sX:WWW;%WWW;%X98M'Xon_)Xon_)Xon_)Xon_)YQOq+YQOq+YQOq+YQOq+YQOq+Z31.-Z31.-Z31.-Z31.-Z31.-Z31.-Z31.-Z31.-Xon_)[KHR1[KHR1[KHR1W!!)#!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TRj$l9-`p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gMM2:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i*Fl+"%d.*u>[t#7hRX)#sX:^'"E9^'"E9^]XW;_?9i=_?9i=_?9i=_?9i=_up&?_up&?_up&?_up&?_up&?`WQ8A`WQ8A`WQ8A`WQ8A`WQ8A`WQ8A`WQ8A`WQ8A_?9i=aoh\Eaoh\Eaoh\E]EA37!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TRr$l9-`p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gLAe:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i+"'+"%d.*u>[t#7hRX)#sX:dKBOMdKBOMe-#aOecYsQecYsQecYsQecYsQfE;0SfE;0SfE;0SfE;0SfE;0Sg&qBUg&qBUg&qBUg&qBUg&qBUg&qBUg&qBUg&qBUecYsQh?3fYh?3fYh?3fYcia=K!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TSE#o<g]p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gIOl:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i+jG+"%d.*u>[t#7hRX)#sX:jobYajobYakQCkcl3%(el3%(el3%(el3%(eli[:gli[:gli[:gli[:gli[:gmK<LimK<LimK<LimK<LimK<LimK<LimK<LimK<Lil3%(encSpmncSpmncSpmj9,G_!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TRb!uD1Wp^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gK6G:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i+R?+"%d.*u>[t#7hRX)#sX:q?-cuq?-cuqud!"rWE3$rWE3$rWE3$rWE3$!!N?&!!N?&!!N?&!!N?&!!N?&!X/Q(!X/Q(!X/Q(!X/Q(!X/Q(!X/Q(!X/Q(!X/Q(rWE3$"pFu,"pFu,"pFu,p]LQs!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TS]$Ps$_p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gM5*:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i%&G-PZk.(D[5\%i,Nj!!!!/"TSN4"TSN6"TSN8"TSN8"TSN8"TSN8"TSN:"TSN:"TSN:"TSN:"TSN:"TSN<"TSN<"TSN<"TSN<"TSN<"TSN<"TSN<"TSN<"TSN8"TSN@"TSN@"TSN@"TSN2"TSN'!!!!:!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?ob_*(C(]M$P+$p#8[XV#9P'!#:I"d%gOa1%gO1j#rbor#.On6<u''`7o(0r58P%>(I&uX%tFuo#6tPQ%mL:2#<r_2#<rG&#6thYVuf1"#R;/1*sWm0',N#,'t=Jj-PZk.(D[5\%i,Nj!!!!C"TSNH"TSNJ"TSNL"TSNL"TSNL"TSNL"TSNN"TSNN"TSNN"TSNN"TSNN"TSNP"TSNP"TSNP"TSNP"TSNP"TSNP"TSNP"TSNP"TSNL"TSNT"TSNT"TSNT"TSNF"TSN'!!!!:!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?oc:2(C(]M$P+$p#8[XV#9P'!#:I"d%gOa1%gO1j#rbor#5AO$<u''`7o(0r58P%>(I&uX%tFuo#6tPQ%mL:2#<r_2#<rG&#6thYVuf1"#R;/1*sWm0',N#,(!m7/-PZk.(D[5\%i,Nj!!!!W"TSN\"TSN^"TSN`"TSN`"TSN`"TSN`"TSNb"TSNb"TSNb"TSNb"TSNb"TSNd"TSNd"TSNd"TSNd"TSNd"TSNd"TSNd"TSNd"TSN`"TSNh"TSNh"TSNh"TSNZ"TSN'!!!!:!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?ocR7(C(]M$P+$p#8[XV#9P'!#:I"d%gOa1%gO1j#rbor#,ho*<u''`7o(0r58P%>(I&uX%tFuo#6tPQ%mL:2#<r_2#<rG&#6thYVuf1"#R;/1*sWm0',N#,'u1%r-PZk.(D[5\%i,Nj!!!!k"TSNp"TSNr"TSNt"TSNt"TSNt"TSNt"TSO!"TSO!"TSO!"TSO!"TSO!"TSO#"TSO#"TSO#"TSO#"TSO#"TSO#"TSO#"TSO#"TSNt"TSO'"TSO'"TSO'"TSNn"TSN'!!!!:!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?o\c7#8R"A%i68l(C1NV+!;(!-b'Bl#;721#9RXd2cgLoa9,4>(!m"P:EE"j(DR/k59C[PJ-lVg#727Y56hc*57\>256hW&#8%iP!^@J,#8]TH#9S%$(FK_.Vue%g'aGfs('b'T((1u[!!$=/!!$=/!!$C1!!$I3!!$I3!!$I3!!$I3!!$O5!!$O5!!$O5!!$O5!!$O5!!$U7!!$U7!!$U7!!$U7!!$U7!!$U7!!$U7!!$U7!!$I3!!$a;!!$a;!!$a;!!$7-!!!$"!!!l:":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C53KO=Z#8R"A%i68l(C1NV+!;(!-b'Bl#;721#9RXd2cgLo3)<TjciQ^5*_/F2'aGO>*u>H<$47"C#oO7<#8%2*%hT%2#7UnC&K.MK58OS1(I&uH+*8/4-P$s5#p1N0#9O`t#6tbT$Q/pE!-/5C!-/5C!-AAE!-SMG!-SMG!-SMG!-SMG!-eYI!-eYI!-eYI!-eYI!-eYI!."eK!."eK!."eK!."eK!."eK!."eK!."eK!."eK!-SMG!.G(O!.G(O!.G(O!,r)A!!*'"!#Yb>#Rh7Y(`XYD-nI&/3'9Go85)iZ=Bo5o^^M"a(&/.I(ENet#S..^+:e])\-ENL0-Cc1+))$?<t>KH:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i#?l-PZk.(D[5\%i,Nj!!!"R"TSOW"TSOY"TSO["TSO["TSO["TSO["TSO]"TSO]"TSO]"TSO]"TSO]"TSO_"TSO_"TSO_"TSO_"TSO_"TSO_"TSO_"TSO_"TSO["TSOc"TSOc"TSOc"TSOU"TSN'!!!!:!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?oaSW(C(]M$P+$p#8[XV#9P'!#:I"d%gOa1%gO1j#rbor#2f_^<u''`7o(0r58P%>(I&uX%tFuo#6tPQ%mL:2#<r_2#<rG&#6thYVuf1"#R;/1*sWm0',N#,'d+SG'aGfs('b'T((1u[!!&Gk!!&Gk!!&Mm!!&So!!&So!!&So!!&So!!&Yq!!&Yq!!&Yq!!&Yq!!&Yq!!&_s!!&_s!!&_s!!&_s!!&_s!!&_s!!&_s!!&_s!!&So!!&l"!!&l"!!&l"!!&Ai!!!$"!!!l:":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C53QMUF#8R"A%i68l(C1NV+!;(!-b'Bl#;721#9RXd2cgLoi!W=^(!m"P:EE"j(DR/k59C[PJ-lVg#727Y56hc*57\>256hW&#8%iP!^@J,#8]TH#9S%$(FK_.a9Ne7'aGfs('b'T((1u[!!'/*!!'/*!!'5,!!';.!!';.!!';.!!';.!!'A0!!'A0!!'A0!!'A0!!'A0!!'G2!!'G2!!'G2!!'G2!!'G2!!'G2!!'G2!!'G2!!';.!!'S6!!'S6!!'S6!!')(!!!$"!!!l:":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C53Of;1#8R"A%i68l(C1NV+!;(!-b'Bl#;721#9RXd2cgLon-Mll(!m"P:EE"j(DR/k59C[PJ-lVg#727Y56hc*57\>256hW&#8%iP!^@J,#8]TH#9S%$(FK_.ciG49'aGfs('b'T((1u[!!'k>!!'k>!!'q@!!("B!!("B!!("B!!("B!!((D!!((D!!((D!!((D!!((D!!(.F!!(.F!!(.F!!(.F!!(.F!!(.F!!(.F!!(.F!!("B!!(:J!!(:J!!(:J!!'e<!!!$"!!!l:":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C53J\%Z#8R"A%i68l(C1NV+!;(!-b'Bl#;721#9RXd2cgLociR!E(!m"P:EE"j(DR/k59C[PJ-lVg#727Y56hc*57\>256hW&#8%iP!^@J,#8]TH#9S%$(FK_.huOoI'aGfs('b'T((1u[!!(RR!!(RR!!(XT!!(^V!!(^V!!(^V!!(^V!!(dX!!(dX!!(dX!!(dX!!(dX!!(jZ!!(jZ!!(jZ!!(jZ!!(jZ!!(jZ!!(jZ!!(jZ!!(^V!!)!^!!)!^!!)!^!!(LP!!!$"!!!l:":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C53QMRE#8R"A%i68l(C1NV+!;(!-b'Bl#;721#9RXd2cgLoTE@tk(!m"P:EE"j(DR/k59C[PJ-lVg#727Y56hc*57\>256hW&#8%iP!^@J,#8]TH#9S%$(FK_.p^&#i'aGfs('b'T((1u[!!)9f!!)9f!!)?h!!)Ej!!)Ej!!)Ej!!)Ej!!)Kl!!)Kl!!)Kl!!)Kl!!)Kl!!)Qn!!)Qn!!)Qn!!)Qn!!)Qn!!)Qn!!)Qn!!)Qn!!)Ej!!)]r!!)]r!!)]r!!)3d!!!$"!!!l:":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C53TpP]#8R"A%i68l(C1NV+!;(!-b'Bl#;721#9RXd2cgLofF(JV(!m"P:EE"j(DR/k59C[PJ-lVg#727Y56hc*57\>256hW&#8%iP!^@J,#8]TH#9S%$(FK_.n-L0a'aGfs('b'T((1u[!!*!%!!*!%!!!!'!!!')!!!')!!!')!!!')!!!-+!!!-+!!!-+!!!-+!!!-+!!!3-!!!3-!!!3-!!!3-!!!3-!!!3-!!!3-!!!3-!!!')!!!?1!!!?1!!!?1!!)p#!!!$"!!!l:":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C53RA0N#8R"A%i68l(C1NV+!;(!-b'Bl#;721#9RXd2cgLop^'_t(!m"P:EE"j(DR/k59C[PJ-lVg#727Y56hc*57\>256hW&#8%iP!^@J,#8]TH#9S%$(FK_.3$0L_#9O`t#6tbT$Q/pE!"oJ9!"oJ9!#,V;!#>b=!#>b=!#>b=!#>b=!#Pn?!#Pn?!#Pn?!#Pn?!#Pn?!#c%A!#c%A!#c%A!#c%A!#c%A!#c%A!#c%A!#c%A!#>b=!$2=E!$2=E!$2=E!"]>7!!*'"!#Yb>#Rh7Y(`XYD-nI&/3'9Go85)iZ=Bo5ofF/Q$(&/.I(ENet#S..^+:e])\-ENL0-Cc1+))$?<t>Mn#u=V;ciQ^5*_/F2'aGO>*u>H<$47"C#oO7<#8%2*%hT%2#7UnC&K.MK58OS1(I&uH+*8/4-P$s%#9P<.#9O`t#6tbT$Q/pE!%%mM!%%mM!%8$O!%J0Q!%J0Q!%J0Q!%J0Q!%\<S!%\<S!%\<S!%\<S!%\<S!%nHU!%nHU!%nHU!%nHU!%nHU!%nHU!%nHU!%nHU!%J0Q!&=`Y!&=`Y!&=`Y!$haK!!*'"!#Yb>#Rh7Y(`XYD-nI&/3'9Go85)iZ=Bo5o\,mHO(&/.I(ENet#S..^+:e])\-ENL0-Cc1+))$?<t>Kh:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i*Ft+"%d.*u>[t#7hRX)#sX:3X,Qa3X,Qa49bcc4pCue4pCue4pCue4pCue5R%2g5R%2g5R%2g5R%2g5R%2g63[Di63[Di63[Di63[Di63[Di63[Di63[Di63[Di4pCue7Krhm7Krhm7Krhm3!K?_!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TRb$Ps$_p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gLAg:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i)kb+"%d.*u>[t#7hRX)#sX::'L[u:'L[u:^-n";?d+$;?d+$;?d+$;?d+$<!E=&<!E=&<!E=&<!E=&<!E=&<X&O(<X&O(<X&O(<X&O(<X&O(<X&O(<X&O(<X&O(;?d+$=p=s,=p=s,=p=s,9EkIs!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TS5!uD1Wp^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gLqm:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i)#E+"%d.*u>[t#7hRX)#sX:@Klf4@Klf4A-N#6Ad/58Ad/58Ad/58Ad/58BEeG:BEeG:BEeG:BEeG:BEeG:C'FY<C'FY<C'FY<C'FY<C'FY<C'FY<C'FY<C'FY<Ad/58D?^(@D?^(@D?^(@?j6T2!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TSM$l9-`p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gFFX<u''`7o(0r58P%>(I&uX%tFuo#6tPQ%mL:2#<r_2#<rG&#6thYVuf1"#R;/1*sWm0',N#,(!$\'-PZk.(D[5\%i,Nj!!!"B"onXH"onXJ"onXL"onXL"onXL"onXL"onXN"onXN"onXN"onXN"onXN"onXP"onXP"onXP"onXP"onXP"onXP"onXP"onXP"onXL"onXT"onXT"onXT"onXF"onW(!!!!:!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?odEZ(C(]M$P+$p#8[XV#9P'!#:I"d%gOa1%gO1j#rbor#+u?"<u''`7o(0r58P%>(I&uX%tFuo#6tPQ%mL:2#<r_2#<rG&#6thYVuf1"#R;/1*sWm0',N#,'aPm/'aGfs('b'T((1u[!!%l\!!%l\!!%r^!!&#`!!&#`!!&#`!!&#`!!&)b!!&)b!!&)b!!&)b!!&)b!!&/d!!&/d!!&/d!!&/d!!&/d!!&/d!!&/d!!&/d!!&#`!!&;h!!&;h!!&;h!!%fZ!!!$"!!!l:":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C53?T+C(&/.I(ENet#S..^+:e])\-ENL0-Cc1+))$?<t>MF"&Du5ciQ^5*_/F2'aGO>*u>H<$47"C#oO7<#8%2*%hT%2#7UnC&K.MK58OS1(I&uH+*8/4-P$q7+"%d.*u>[t#7hRX)#sX:Sd#/pSd#/pTEYArU':StU':StU':StU':StU]pf!U]pf!U]pf!U]pf!U]pf!V?R##V?R##V?R##V?R##V?R##V?R##V?R##V?R##U':StWWiG'WWiG'WWiG'S-Arn!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TSM#o<g]p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gLA]:KJ:X!_6$-7m@e)#8]TH(Cu$'$3peB)%Sq:&I1N2&I1N*%0m+M)5mU$(C16^59C+PF;#H<%i*.j+"%d.*u>[t#7hRX)#sX:Z3C:/Z3C:/Zj$L1[KZ^3[KZ^3[KZ^3[KZ^3\-;p5\-;p5\-;p5\-;p5\-;p5\cr-7\cr-7\cr-7\cr-7\cr-7\cr-7\cr-7\cr-7[KZ^3^'4Q;^'4Q;^'4Q;YQb(-!<<*")#sdF$kO*i*$?LT/2/n?4?u;*9Me\j>[TRr$Ps$_p^7TK*X<Je%gO1!%gOJl#7h%m+:e]!BaH_"%gEkH<u''`7o(0r58P%>(I&uX%tFuo#6tPQ%mL:2#<r_2#<rG&#6thYVuf1"#R;/1*sWm0',N#,(!lt'-PZk.(D[5\%i,Nj!!!#="onYC"onYE"onYG"onYG"onYG"onYG"onYI"onYI"onYI"onYI"onYI"onYK"onYK"onYK"onYK"onYK"onYK"onYK"onYK"onYG"onYO"onYO"onYO"onYA"onW(!!!!:!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?oa;W(C(]M$P+$p#8[XV#9P'!#:I"d%gOa1%gO1j#rbor#5A6q<u''`7o(0r58P%>(I&uX%tFuo#6tPQ%mL:2#<r_2#<rG&#6thYVuf1"#R;/1*sWm0',N#,(#T*7-PZk.(D[5\%i,Nj!!!#Q"onYW"onYY"onY["onY["onY["onY["onY]"onY]"onY]"onY]"onY]"onY_"onY_"onY_"onY_"onY_"onY_"onY_"onY_"onY["onYc"onYc"onYc"onYU"onW(!!!!:!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?od]b(C(]M$P+$p#8[XV#9P'!#:I"d%gOa1%gO1j#rbor#070J<u''`7o(0r58P%>(I&uX%tFuo#6tPQ%mL:2#<r_2#<rG&#6thYVuf1"#R;/1*sWm0',N#,(&/(W-PZk.(D[5\%i,Nj!!!#e"onYk"onYm"onYo"onYo"onYo"onYo"onYq"onYq"onYq"onYq"onYq"onYs"onYs"onYs"onYs"onYs"onYs"onYs"onYs"onYo"onZ""onZ""onZ""onYi"onW(!!!!:!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?oduj(C(]M$P+$p#8[XV#9P'!#:I"d%gOa1%gO1j#rbor#07$F<u''`7o(0r58P%>(I&uX%tFuo#6tPQ%mL:2#<r_2#<rG&#6thYVuf1"#R;/1*sWm0',N#,(%;MO-PZk.(D[5\%i,Nj!!!!##64`*#64`,#64`.#64`.#64`.#64`.#64`0#64`0#64`0#64`0#64`0#64`2#64`2#64`2#64`2#64`2#64`2#64`2#64`2#64`.#64`6#64`6#64`6#64`(#64`)!!!!:!!EQ9&/5s$+=&?d0JkaO5X\.::fLP%?od]_(C(]M$P+$p#8[XV#9P'!#:I"d%gOa1%gO1j#rbor#1s5X<u''`7o(0r58P%>(I&uX%tFuo#6tPQ%mL:2#<r_2#<rG&#6thYVuf1"#R;/1*sWm0',N#,'f[9_'aGfs('b'T((1u[!!!c>!!!c>!!!i@!!!oB!!!oB!!!oB!!!oB!!!uD!!!uD!!!uD!!!uD!!!uD!!"&F!!"&F!!"&F!!"&F!!"&F!!"&F!!"&F!!"&F!!!oB!!"2J!!"2J!!"2J!!!]<!!!$"!!!l:":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C53TpM\#8R"A%i68l(C1NV+!;(!-b'Bl#;721#9RXd2cgLo85E;%ciQ^5*_/F2'aGO>*u>H<$47"C#oO7<#8%2*%hT%2#7UnC&K.MK58OS1(I&uH+*8/4-P$s%#9P<.#9O`t#6tbT$Q/pE!%J3R!%J3R!%\?T!%nKV!%nKV!%nKV!%nKV!&+WX!&+WX!&+WX!&+WX!&+WX!&=cZ!&=cZ!&=cZ!&=cZ!&=cZ!&=cZ!&=cZ!&=cZ!%nKV!&b&^!&b&^!&b&^!%8'P!!*'"!2KYr":,DI'Gqf4,Ub2t1cRT_6qC!J<*3C5A8#duFEi1`!JCK0!K7&@!L*VP!Ls1`!Mfap!NZ=+!OMm;!PAHK!Q5#[!R(Sk!Rq/&!Sd_6!TX:F!UKjV!V?Ef!W2tK!e^W2!fR2B!gEbR!h9=b!i,mr!iuI-!ji$=!k\TM!lP/]!mC_m!n7;(!o*k8!osFH!pg!X!qZQh!rN+M",$c4",m>D"-`nT".TId"/H$t"0;U/"1/0?"2"`O"2k;_"3^ko"4RG*"5F":"69RJ"7--Z"7u]j"8i7O"G?o6"H3JF"I'%V"IoUf"Jc1!"KVa1"LJ<A"M=lQ"N1Ga"O%"q"OmS,"Pa.<"QT^L"RH9\"S;il"T/CQ"b[&8"cNVH"dB1X"e5ah"f)=#"fqm3"geHC"hY#S"iLSc"j@.s"k3_."l':>"lojN"mcE^"nVun"oJOS#)!2:#)ibJ#*]=Z#+Pmj#,DI%#-8$5#.+TE#.t/U#/g_e#0[:u#1Nk0#2BF@#36!P#4)Q`#4r,p#5e[U#D<><#E/nL#F#I\#Fl$l#G_U'#HS07#IF`G#J:;W#K-kg#L!G"#Lj"2#M]RB#NQ-R#OD]b#P88r#Q+gW#_WJ>#`K%N#a>U^#b20n#c%a)#cn<9#dalI#eUGY#fI"i#g<S$#h0.4#i#^D#il9T#j_id#kSDt#lFsY$%rV@$&f2/!XAr9&"3P1#64uN%j)$(ciFXn*u>n=(C(Z[#8\JV!Z)(A#:C<0#;>!9%i6T0*%)g5'aFsc+0#Aa#64u^+!1_Hp^%HI0,GT]-O1@k#:CV!![e3Q#<+"P#=%\a%i7/@*&fMU'aFss+1_M,#64un0-:Eh3"Hfi(E>Xu#8IIK2]om<2[9<f7lMLp:UgW?(Io8]7m@4n#7!I8aoXd4!!c:a*sYlo#nIhJ(E?4@#8IIK7j$.\7gB#!=%=>;?bcmW(KVCm=&0&9#7"$Hg&b%T!!ck,*sZGW!Y6)S(E?d`#8IIK=!-E'<sJ^1B3-/[Do`4q(M=O(B3tlY#7"TXl2k;t!!dFL*s[#"!Y6)c(E@@+#8IIKB-6[GB*SDAG@r!&J+*dU(O$Z8GAd^$#7#/hq>tR?!!e!l*s[Q%fEi')Ihs)SG6\if#Bq8A"*XtM#DW>(*s[i-(_7F<!>c`2!Ik=h#7#`#M?A>5!!ePcIieo^!@SHpNr^%:Nrb":#8IIKLB/K[",?m^!!ehkLB/J%T)mjV%i:Q5(EAbBNr]J##7$:j+.<:m!=&T0T)juR*s\\EciO^oT)f`JT)k8Z#8IIKQN82&".'#n!!fD&QN805Y5o1F(T.9M*2`h0!='>E#G2#=WWSjo#65"4!M9B7#Iaa/$4drV!>c`Z!N,r''aFuA!?\TLVZ@#&#Ia`3!?VQ]!ItOg(UjD]*4GsP!='>E#Hn.M\c],:#65"D!NuMG#KHl/!Y6*^!>c`j!Oi(7'aFuQ!?]/\[fH^6#KHkS!?VQm!I,+k`rQtr`rWpU#8IIK^B#G!"2=jA!!ggN^B#D]f)^[8%i<Om(ECa%`rQD[#7&9M+4:83!=&T0f)`nm*s^[(O:)R8f)Z[-f)a1u#8IIKcN,-A"4$uQ!!hB^cN,*mk5gqX%i=+((ED<5f)Z*k#7&i]+6!CS!=&T0k5j08*s_688.QO"!>ca=!T*n_'aG!$!?^S/hZ3r^#O_]N!?VR@!Vc^,([hA@*:Epk!='>E#Nl+0ncS%U#65#'!TsJ*#QFgt$P+'J!>caM!Ug$o'aG!4!?_.?mf<Xn#QFhn!?VQ%!\b-$rrEoUrrMip#8IIKpAl@f"SVp%!!e8\pAl?@NrksV%i:!&(EA23rrE?>#7(80+,U4$!=&T0Nro=^*s\,6i!0c/Nrg+;Nrk(<#8IIKLB8Q\"G[$`!!ehlLB8P&T)tr!%i:Q6(EAbCNrfP$#7$:k+.<=n!XA]1T)t&T*s\\FYR:sXT)ofKT)t>\#8IIKQNA8'"IB/p!!fD'QNA66Y6*V`%i;,F(EB=ST)o64#7$k&+0#I9!XA]1Y6(<t*s]7VO96"0Y6#L[Y6(U'#8IIKVZIsG"K);+!!ft7VZIqF^B1nQ%i;\V(EBmcY6"qD#7%F6+1_TY!XA]1^B1S?*s]gf^^CYh^B,2k^B1kG#8IIK[fRYg"LeF;!!gOG[fRWVcN8Uu%i<7f(ECHs^B+WT#7&!F+3F`$!XA]1cN:i_*s^C!VumPHcN4n&cN;,g#8IIK`r[@2"NLQK!!h*W`r[=fhZCk,%i<h!(ED$.cN4=d#7&QV+5-kD!XA]1hZD+**s^s1\-!6XhZ=T6hZDC2#8IIKf)d&R"P3\[!!hZgf)d$!mfLiD%i=C1(EDT>hZ=#t#7',f+6j!d!XA]1mfMAJ*s_NAfF&3+mfF:FmfMYR#8IIKk5lar"Qogk!!i6"k5l_1rrV*d%i=sA(EE/NmfE_/#7']!+8Q-/!XA]1rrVWj*s[Q'a9)qhrrNuVrrVor#8IIKpAuFg"nr''!!e8]pAuEANs"SR%i:!'(EA24rrNE?#7(81+,U7%!XA]1Ns#C`*s\,7n-]aCNrp1<Nrt.>#8IIKLBAW]"c!0b!!ehmLBAV'T*(Gf%i:Q7(EAbDNroV%#7$:l*s[i/#9O23!uD^X#7hS,,QRlFH34-IHij?KNWT7]NWT7]NWT7]NWT7]NWT7]O95I_U&tAqU&tAqU&tAqU&tAqU&tAqU]USs[K?L0[K?L0[K?L0[K?L0[K?L0\,u^2ao_VDao_VDao_VDao_VDao_VDbQ@hFh?*`Xh?*`Xh?*`Xh?*`Xh?*`Xhu`rZncJjlncJjlncJjlncJjlncJjloE,'n"p=o+"p=o+"p=o+"p=o+"p=o+#Qt,-)?^$?)?^$?)?^$?)?^$?)?^$?*!?6A/d).S/d).S/d).S/d).S/d).S0E_@U63I8g63I8g63I8g63I8g63I8g6j*Ji<WiC&<WiC&<WiC&<WiC&<WiC&=9JU(C'4M:C'4M:C'4M:C'4M:C'4M:C]j_<IKTWNIKTWNIKTWNIKTWNIKTWNJ-5iPOotabOotabOotabOotabOotabPQUsdV??l!V??l!V??l!V??l!V??l!W!!)#\c`!5\c`!5\c`!5\c`!5\c`!5]EA37c3++Ic3++Ic3++Ic3++Ic3++Icia=KiWK5]iWK5]iWK5]iWK5]iWK5]j9,G_p&k?qp&k?qp&k?qp&k?qp&k?qp]LQs$3^D0$3^D0$3^D0$3^D0$3^D0$j?V2*X)ND*X)ND*X)ND*X)ND*X)ND+9_`F1'IXX1'IXX1'IXX1'IXX1'IXX1^*jZ7Kibl7Kibl7Kibl7Kibl7Kibl8-Jtn=p4m+=p4m+=p4m+=p4m+=p4m+>Qk*-D?U"?D?U"?D?U"?D?U"?D?U"?E!64AJcu,SJcu,SJcu,SJcu,SJcu,SKEV>UQ3@6gQ3@6gQ3@6gQ3@6gQ3@6gQj!HiWW`A&WW`A&WW`A&WW`A&WW`A&X9AS(^'+K:^'+K:^'+K:^'+K:^'+K:^]a]<dKKUNdKKUNdKKUNdKKUNdKKUNe-,gPjok_bjok_bjok_bjok_bjok_bkQLqdq?6j!q?6j!q?6j!q?6j!q?6j!qum'#%L)n5%L)n5%L)n5%L)n5%L)n5&-`+7+pJ#I+pJ#I+pJ#I+pJ#I+pJ#I,R+5K2?j-]2?j-]2?j-]2?j-]2?j-]3!K?_8d57q8d57q8d57q8d57q8d57q9EkIs?3UB0?3UB0?3UB0?3UB0?3UB0?j6T2EWuLDEWuLDEWuLDEWuLDEWuLDF9V^FL'@VXL'@VXL'@VXL'@VXL'@VXL^!hZRK``lRK``lRK``lRK``lRK``lS-ArnXp+k+Xp+k+Xp+k+Xp+k+Xp+k+YQb(-_?Ku?_?Ku?_?Ku?_?Ku?_?Ku?`!-2Aecl*Secl*Secl*Secl*Secl*SfEM<Ul374gl374gl374gl374gl374glimFirWW?&rWW?&rWW?&rWW?&rWW?&!!`K(&dJC:&dJC:&dJC:&dJC:&dJC:'F+U<-3jMN-3jMN-3jMN-3jMN-3jMN-jK_P3X5Wb3X5Wb3X5Wb3X5Wb3X5Wb49kid49kidGQRpGzbl[qK#Rh7Y(`XYD-nI&/3'9Go85)iZ=Bo6EBP_X0G^P#BKE6l0Muf"@PQ@-PS,o8`U]ICpX9#O+ZiRZ;]E,eK_u[p[bQ6&ke,e2&g]?=6j8nHFliHSVoE"^fquM<LKE?r2Muo(BPQI3RS-#>bU]RIrX9,U-Zi[`=]E5kM_ue!]bQ?,me,n8(g]HC8j9"NHliQYXoE+dhquVBNKEI#4N!#.DPQR9TS-,DdU][OtX95[/Zidf?]E>qO_un'_bQH2oe-">*g]QI:j9+TJliZ_ZoE4jjqu_HPKER)6N!,4FPQ[?VS-5JfU]dV!X9>a1ZimlA]EH"Q`!"-abQQ8qe-+D,g]ZO<j94ZLlice\oE=plquhNRKE[/8N!5:HPQdEXS->PhU]m\#X9Gg3Zj!rC]EQ(S`!+3cbQZ>se-4J.g]cU>j9=`Nlilk^oEG!nquqTTKEd5:N!>@JPQmKZS-GVjU^!b%X9Pm5Zj+#E]EZ.U`!49ebQcDue-=P0g]l[@j9FfPliuq`oEP'pr!%ZVKEm;<N!GFLPR!Q\S-P\lU^*h'X9Ys7Zj4)G]Ec4W`!=?gbQlK"e-FV2g]uaBj9OlRlj*"boEY-rr!.`XKF!A>N!PLNPR*W^S-YbnU^3n)X9c$9Zj=/I]El:Y`!FEibQuQ$e-O\4g^)gDj9XrTlj3(doEb3tr!7fZKF*G@N!YRPPR3]`S-bhpU^<t+X9l*;ZjF5K]Eu@[`!OKkbR)W&e-Xb6g^2mFj9b#Vlj<.foEk:!r!@l\KF3MBN!bXRPR<cbS-knrU^F%-X9u0=ZjO;M]F)F]`!XQmbR2](e-ah8g^;sHj9k)XljE4hoEt@#r!Ir^KF<SDN!k^TPREidS-tttU^O+/X:)6?ZjXAO]F2L_`!aWobR;c*e-jn:g^E$Jj9t/ZljN:joF(F%r!S#`KFEYFN!tdVPRNofS.)&!U^X11X:2<AZjaGQ]F;Ra`!j]qbRDi,e-st<g^N*Lj:(5\ljW@loF1L'r!\)bKFN_HN"(jXPRWuhS.2,#U^a73X:;BCZjjMS]FDXc`!scsbRMo.e.(%>g^W0Nj:1;^lj`FnoF:R)r!e/dKFWeJN"1pZPRa&jS.;2%U^j=5X:DHEm/mRu#S.7Q#65AQ#65Ya#65qq#665,#66M<#66eL#65!!&.]"A(_6jQ#6G-;+:e]i:EKg[+:e]aBaG#o+:e^4!Cn4:Nr^@6#Cf#G.'EZ<!<t6e!I"aW!N,t%!>RSd!N,r>+O:(4#Y2o9cN+6:!P\ZU!>V4-=2+b\#CfD\#@DQd6=1f7#7!a@#7"$H#7"<P8nSq?#7!a@#7"TX;Jud?>'C2O@XeU_C52g#!!`aQ+**DC%fch>(E[si!=o/8#EJm-JcVJE#69V^VZ@#&Oo_`e#6:1n[fH^6U&i"0#6:b)`rQDFZ2r8P%fch>`rR:)!S7>_!!``>*s^[(f)Zruk5dgY#O_[a%i=+(*ukOK!S7>o#O_[i%gVh08.QO"!?W9dmfD#@*s_N@=:YZ:!D!_;mf=LM#PS8N!?VRH!FQECLB:!W(\[qP*!cKEf)ZruLB;-"#EJpW%i>6H*ukN@!nRGp#EJq*%gSF&GRkUG!ZrBeNrmo6*s\,6J,p/cT)s6J(QSV>*!_f3f)ZruT)sfL%gT!6GRkUW!ZrBeT*!UF*s\\FO9#jsY6&qZ(S:aN*!`ACf)ZruY6('l%gTQF&.]ST!ZrBeY6*;V*s]7VTE,Q.^B+rW(U!l^*!`qSf)Zru^B1>7%gU,V&.]Sd!ZrBe^B3!f*s]gfYQ57>cN4Xg(V^"n*!aLcf)ZrucN:TW%gU\f&.]St!ZrBecN;]!*s^C!^]=rNhZ=?"(XE.)*7=l>!e11T#N#P(#7'Dm*sW&>!?VOOpAl?@#QFfH#7$"c*sW%3!ZqXPQNA66#G2&>#7%..*sW%S!ZqXP[fRWV#JU<^#7&9N*sW%s![$+shZ=#_iW83D#6=#imfE^o#PS9)!mguB!ltBehuWQRfE!5d!VZZZ!@**rpB(*j,9Z^^L]Se,pB$EX,Otm8!Z(hA#PS9A#7"TXq>l?R%fch>pAuFg!fmEg!!ehmQi[eU!hTS@!<<?0D]]2hLB/J%#F>H5#7!I8#7(81*sW%+"!7aQY5o^M#Cdg##A5+`#G2#=#6un(#7!10#7%.-*sW%s!?VOO%j)#]f)d$!#PS9A#7&!E*sW&.!ZqXPk5l_1#O_^9#7$:l*sW%;"!7aQ[fIQU#6u?6!iH,:!!``>*sW&.!Zq[9"fDGE#PSCp!Y5P9"b6Xb#DWM^!Y6+9"Xb;Y"m6$o'aOI:VZS"GrroV.%gRjoJ-$5dNs<)q%i=sD-QMjahZ`0H'aOaBVZS"GLBbNq%gS."J-$5dQNeiK(]OXd*<-2o"lBIu#DWM]"!7c/#06iV#F>XF!Y5O.#1*D^(P`2B*/=aE"kNnm#EK(e"!7c7#1rtf#G24Y!Y5O6#3Z+!(QSbJ*01<E"j[>e#F>Xm"!7c?#4M[)#H%da!Y5O>#5A61(RG=R*1$lE"igc]#G23u"!7cG#(Qdd#Hn?i!Y5OF"u$Q(T*?Y_T*Db.^BG>WVZs%$*s\tRL]\.m[g(al%gTiRO96"0VZnLgVZs=.[fmKOY6Lm,*s]7ZQidj(^BU>5%gU,ZVumPHY6H?oY6Lm.Y6>XG[g&`4*s]ObYQGC@`s/1=%gUDb\-!6X[g"3"[g&H.VZde?^BUS<*s]gj^]P)PcN^$E%gU\ja9)qh^BQ&*^BU#.T*5r7`s/FD*s^*rciXd`f*7lM%gUtrfE2X#`s*n2`s.S.QN\*/cN^9L*s^C%huaJphZcU^#Nl<T!tQ3o"t(D:#)<AC"Vh9o#,_PF#N#aT!tPY"#"T70mfrOh%i<h%-QL_Brre)\'aNV#VZS"Gk6?G>%gVP-8.Pt"#)EBm(Z,EE*8^tp"TJT>#Nl;h"!7d:#*8ru#PSEn%gW+=Qimp9k6<:Rk6CAXpB239mfoZl*s_NETEGc1rs!]Y#DWP_":l=;"t(DZ#3Q-X";M19#,_PF#QG"4":k`m#C$aaNsE/t%i=sE-QMjbhZW*F'aOaCVZS"GLBkTt%gS.#GRk%G#KR#Y(]O[e*<-5p"Q'=s#DWP^"!7c/#LESa#F>[?%gS^3fE;^$LBf1HLBl-.f)ufnNsDQb*s\,;hujPqT*KTO#H%gj":l<0#:CLP#KHtn";M0.#H%YG#G27j":ka8#C$aaY6Xh*%i:Q;-QJHX^BDR['aL?9VZS"GV[%_U%gT9CGRk%g#D`No(S:p[*1mJF"MY'S#H%g)"!7cO#ET*"#IapL%gTiSQj"!:V["RhV['C.[fdENY6Us-*s]7[TEPi2^BY;\#KI(J"V2EQ#:CLp#H%^.";M0N#H%YG#JUMJ"V1jY#7qCNcNgr`%i;\[-QKT#T*2%p'aMJYVZS"G`s9B`%gUDcJ-$5df*BA#%i;tc-QKl+QNWo`'aMbaVZS"GcNhf#%gU\kJ-$5dhZqd;%i<7k-QL/3Ns(dP'aN%iVZS"Gf*C4;%gUtshuXDok6L2S%i<Os-QLG;LBNY@'aN=qVZS"GhZrWS%gV8&huXDomg&Uk%i<h&-QL_Crr\#Z'aNV$VZS"Gk6HMA%gVP.TE>]0pBQKY%i=+.-QM"KpB1Et'aNn,VZS"Gmg"pY%gVh6TE>]0rs+nq%i=C6-QM:SmfW:d'aO14VZS"GpBR>q%gW+>8.Pr\#cIq<([hSV*:F-q"7H=,#PSJ$"!7dJ#I"CC#DWRU%gS.$\-<H[pBN&cpBTRXk5uG(rs,G(*s[Q,^]k;SNsKt@#F>_;"qMOM#:CMk#M0(8!u2&r#c@bH#EK/;"qLs*#^?jbT*X'R%i:!,-QImIcNDc$'aKd*VZS"GQO)LR%gS^4J-$5dV[2Jj%i:94-QJ0Q`rjWi'aL'2VZS"GT*Xoj%gT!<J-$5dY6an-%i:Q<-QJHY^B;LY'aL?:VZS"GV[.eX%gT9DJ-$5d[g7cp%i:iD-QJ`a[faAI'aLWBVZS"GY6^3p%gTQLJ-$5d^Bg23%i;,L-QK#iY6269'aFuI"!<s8Y6,"0#JUAE"!8>o!tQBd"1J@;'aFuQ"!7cW".oZ;(UjJW*!a4\TEcA?`ridQ*tQ*g(E<[p"/#l;#KHr@![!4"`rj?a'G%q\(E<[p"/#l;#KHqF#9'fO`rj?a'F2qd-Q`TF"1J@S(XE1"*!b't+:e_7"1SRH#KHoo*"Tdd#93u`"/#l;#KHp"*s^*o^]tAT`rd+t&&/2O*!a4\TEcA?`rfrr#L<Ln#7h'k"3:]X#KHog*"Tdd#93u`"/#l;#KHp**s^*ocj('df)sY1%gU,W*ukg+!s]eN#6tkH#7hT+!R1WF!!3-#!!WE'!#>P7!$VCC!&OZU!'gMa!)`ds!+5d,!.4bH!.4bH!.FnJ!.Y%L!.Y%L!.Y%L!.Y%L!.k1N!.k1N!.k1N!.k1N!/(=P!/(=P!/(=P!/(=P!/(=P!/(=P!/(=P!/(=P!.k1N!.Y%L!/pmX!/pmX!/pmX!/pmX!1!Tb!1!Tb!1!Tb!5JR7!6>-?!7CiI!87DQ!87DQ!:0[c!:0[c!;lfs!;lfs!$VFD!&=QT!+5g-!-SAC!0dKa!3Q>&!6P<B!6P<B!9+"Z!9+"Z!"]23!"]23!"]23!"]23!"o>5!"o>5!"o>5!"o>5!#,J7!#,J7!#,J7!#,J7!#>V9!#>V9!#>V9!#>V9!#Pb;!#Pb;!#Pb;!#Pb;!#bn=!#bn=!#bn=!#bn=!#u%?!#u%?!#u%?!#u%?!$21A!$21A!$21A!$21A!$D=C!$D=C!$D=C!$D=C!$VIE!$VIE!$VIE!$VIE!$hUG!$hUG!$hUG!$hUG!%%aI!%%aI!%%aI!%%aI!%7mK!%7mK!%7mK!%7mK!%J$M!%J$M!%J$M!%J$M!%\0O!%\0O!%\0O!%\0O!&+HS!&+HS!&+HS!&+HS!&+HS!&+HS!&+HS!&+HS!&+HS!&+HS!&+HS!&+HS!&+HS!&+HS!&+HS!&+HS!'C;_!([.k!)s""!+5j.!+5j.!+5j.!+5j.!+5j.!+5j.!+5j.!+Z-2!+Z-2!+Z-2!-SDD!-SDD!/^gX!3cM)!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!42e-!<*$"!<*$"!<*$"!%%dJ!%%dJ!%%dJ!%%dJ!%%dJ!$hXH!%7pL!%7pL!%7pL!%7pL!%7pL!$hXH!%J'N!%J'N!%J'N!%J'N!%J'N!$hXH!%\3P!%\3P!%\3P!%\3P!%\3P!$hXH!%n?R!%n?R!%n?R!%n?R!%n?R!$hXH!&+KT!&+KT!&+KT!&+KT!&+KT!$hXH!&=WV!&=WV!&=WV!&=WV!&=WV!$hXH!&OcX!&OcX!&OcX!&OcX!&OcX!$hXH!&aoZ!&aoZ!&aoZ!&aoZ!&aoZ!$hXH!&t&\!&t&\!&t&\!&t&\!&t&\!$hXH!'12^!'12^!'12^!'12^!'12^!$hXH!'C>`!'C>`!'C>`!'C>`!'C>`!$hXH!'UJb!'UJb!'UJb!'UJb!'UJb!$hXH!'gVd!'gVd!'gVd!'gVd!'gVd!$hXH!($bf!($bf!($bf!($bf!($bf!$hXH!(6nh!(6nh!(6nh!(6nh!(6nh!$hXH!(I%j!(I%j!(I%j!(I%j!(I%j!$hXH!([1l!([1l!([1l!([1l!([1l!$hXH!(m=n!(m=n!(m=n!(m=n!(m=n!$hXH!)*Ip!)*Ip!)*Ip!)*Ip!)*Ip!$hXH!)<Ur!)<Ur!)<Ur!)<Ur!)<Ur!$hXH!)Nat!)Nat!)Nat!)Nat!)Nat!$hXH!)`n!!)`n!!)`n!!)`n!!)`n!!$hXH!)s%#!)s%#!)s%#!)s%#!)s%#!$hXH!*01%!*01%!*01%!*01%!*01%!$hXH!*B='!*B='!*B='!*B='!*B='!$hXH!*TI)!*TI)!*TI)!*TI)!*TI)!$hXH!*fU+!*fU+!*fU+!*fU+!*fU+!$hXH!+#a-!+#a-!+#a-!+#a-!+#a-!$hXH!+5m/!+5m/!+5m/!+5m/!+5m/!$hXH!+H$1!+H$1!+H$1!+H$1!+H$1!$hXH!+Z03!+Z03!+Z03!+Z03!+Z03!$hXH!+l<5!+l<5!+l<5!+l<5!+l<5!$hXH!,)H7!,)H7!,)H7!,)H7!,)H7!$hXH!,;T9!,;T9!,;T9!,;T9!,;T9!$hXH!,M`;!,M`;!,M`;!,M`;!,M`;!$hXH!,_l=!,_l=!,_l=!,_l=!,_l=!$hXH!,r#?!,r#?!,r#?!,r#?!,r#?!$hXH!-//A!-//A!-//A!-//A!-//A!$hXH!-A;C!-A;C!-A;C!-A;C!-A;C!$hXH!$hXH!-eSG!'gbh!'gbh!'gbh!'gbh!(7%l!(7%l!(I1n!(I1n!(I1n!([=p!([=p!([=p!([=p!(mIr!(mIr!(mIr!(mIr!(mIr!(mIr!(mIr!(mIr!(mIr!(mIr!)*Ut!)*Ut!)*Ut!)*Ut!)*Ut!)<b!!)<b!!)<b!!)<b!!)<b!!)<b!!)Nn#!)Nn#!)Nn#!)Nn#!)Nn#!)Nn#z!)a%%z!)rpu]=], 6)));
  aX[1][0x2b] = 4294967296;
  (aX[0x1])[0b10001] = {};
  aX[0x1][0B1000000] = aX[0B1][0x35](T, aX);
  ((aX)[1.0])[18.0] = function(...)
    return (T):f(aX, ...);
    end;
  return function(...)
    return aX[0X1][18.0](aX[0X1][64.0], aX[0X1][0b10001])((aX[1.0])[0b1101], (aX[0b1])[0X80], (aX[1])[0x81], (aX)[0b1][0B10000010], (aX[0x1])[131.0], ((aX)[1.0])[0x84], (aX[0X1])[0B10010]);
    end;
  end,dX = function(T, T)
  local V = { T,};
  return V;
  end,r = (bit32 or bit).bxor,nK = {},L = function(T, a)
  local E = {};
  for M =0X24, 0x24, 36.0 do
    T:Nf(a, M, E);
    end;
  return T.z(T:y(a, E));
  end,zR = function(T, e)
  local p;
  for g =0b101011, 0x5cc, 0b10000011 do
    if not (g < 829.0) then
      if not (g < 0X4C6) then
        if g >= 1484 then
          T.W = p.readstring;
          else
          if not (g < 0X549) then
            T.K = p.readu32;
            for r =0X35, 0b11101100, 61.0 do
              T:Du(r, e);
              end;
            else
            T.F = p.tostring;
            for dO =0B11110, 0x12f, 0x5b do
              T:pN(dO, e);
              end;
            end;
          end;
        else
        if g >= 0x443 then
          for tP =0x32, 0x1da, 0X6A do
            T:iS(tP, e);
            end;
          elseif g >= 960.0 then
          T.E = p.fromstring;
          else
          T.w = p.readu8;
          for v =0X3B, 491.0, 0X6C do
            T:On(v, e);
            end;
          end;
        end;
      else
      if not (g < 0B110110100) then
        if not (g < 0x2ba) then
          for xC =0B1000011, 0x1cb, 0x62 do
            T:Ug(xC, e);
            end;
          elseif g >= 0x237 then
          T.R = p.writeu8;
          else
          T.d = p.readf64;
          for B =0X34, 0x19c, 0X5A do
            T:Si(B, e);
            end;
          end;
        elseif not (g < 0x131) then
        for C =54, 0b101001110, 0x46 do
          T:Vl(C, e);
          end;
        else
        if g >= 0xae then
          p = buffer;
          T.b = p.create;
          else
          for W =0x43, 0x1af, 0X5B do
            T:Cb(W, e);
            end;
          end;
        end;
      end;
    end;
  end,Z = function(T, K, q, u)
  u[3.0] = u[0X3] or 1;
  u[0b10] = (u[0x2] or (# u[0B1]));
  end,t = function(T, Y)
  local L = {};
  for R =0X3D, 0B110000_11, 0X43 do
    (T):H(Y, R, L);
    end;
  return T:j(Y, L);
  end,pN = function(T, w, v)
  if w >= 0b100101111 then
    (v[0x1])[0x23] = T.mM;
    else
    if w >= 212.0 then
      v[0x1][0x3f] = T.Gk;
      else
      if not ((w < 0B1111001)) then
        ((v)[0b1])[0b10] = (T.Uy);
        else
        if(not (w < 0x79)) then
          else
          (v[0B1])[0x13] = (T.r);
          end;
        end;
      end;
    end;
  end,Yq = function(T, K, G, n)
  if not (G < 0X63) then
    K[0x1][33.0] = (K)[1][0X21] + n[1.0];
    else
    if not ((not ((G ~= 22.0)))) then
      else
      n[0b1] = K[0x1][0x9](T, K);
      n[0X2] = T.W(((K)[1.0])[49.0], (K[0X1])[0B100001] - 1, n[0X1]);
      end;
    end;
  end,j = function(T, T, x)
  return x[3.0];
  end,Nd = function(T, T, g)
  return ((((((T - g[0XA]) + g[1.0]) + g[3.0]) - g[0B1]) + g[0x3]));
  end,zN = function(T, T, C, D, L, qO)
  local x = (# ((T[1.0])[0b100000]));
  ((T[1.0])[0X20])[x + 1] = C[7];
  (T[0B1])[32.0][x + 2] = D;
  (T[0x1])[32][x + 3] = L;
  qO[D] = true;
  end,Uy = function(T, s, vK)
  local v = ((s)[0x1])[0B111110](T, s);
  if v == 3 then
    (((s)[1.0])[11.0])[vK] = s[0B1][0x3f](T, s);
    else
    if v == 7 then
      s[0B1][0B1011][vK] = nil;
      else
      if v < 3 then
        s[0B1][11][vK] = (s[0X1])[0x3e](T, s) == 1;
        else
        if(v == 5) then
          T:Vq(s, vK);
          else
          (s[0B1])[0XB][vK] = ((s)[0B1])[0B1100](T, s);
          end;
        end;
      end;
    end;
  end,v = function(T, T, s, cU)
  return (T[0b1])[0x13]((T[0x1])[15.0](s) or 0, T[0b1][0XF](cU) or 0);
  end,Xr = function(T, T, nG, U, s)
  nG[13][U] = true;
  (nG[4])[U] = ((T[0B1])[0XB][s]);
  end,xK = function(T, w, yU, q)
  q[1.0] = T.K((w[0b1])[0b110001], ((w[0X1])[0X21] - 1));
  (w[0b1])[33] = ((w[1.0])[33.0] + 4);
  end,Re = function(T, S, Mj)
  if not ((S < 0x6d)) then
    (Mj)[0X1][0b11011] = (T.i);
    else
    Mj[0b1][12.0] = T.t;
    end;
  end,Gk = function(T, x)
  local K = {};
  for Ju =24.0, 24.0, 32.0 do
    (T):gX(x, Ju, K);
    end;
  return T:Ax(x, K);
  end,Ug = function(T, m, p)
  if(m >= 0x107) then
    if not ((m < 0x1cb)) then
      (p[0X1_])[0x25] = (T.v);
      else
      if m >= 0b101101001 then
        (p[1.0])[0x10] = (T.c);
        else
        (p[1])[0X22] = (T.nF);
        end;
      end;
    elseif not (m < 165) then
    (p[1.0])[0X33] = T.f;
    else
    p[0x1_][0b1111] = (T.A);
    end;
  end,Vy = function(T, F)
  local qX = {};
  for y =0X15, 0b1010010, 61.0 do
    (T):kV(F, y, qX);
    end;
  return T.z(T:dT(F, qX));
  end,Ll = function(T, x, L)
  local v = { L,};
  for Ww =56.0, 0X8E, 86.0 do
    (T):Op(x, Ww, v);
    end;
  return { T:sK(x, v),};
  end,H = function(T, m, y, h)
  if y >= 195.0 then
    h[0x3] = (h[2] * (m[1.0])[43.0] + h[0x1]);
    else
    if not (y < 0x80) then
      if(h[0b10] >= (m[0x1])[21]) then
        h[2.0] = ((h)[2.0] - (m)[1][0b101011]);
        end;
      elseif not (y < 0x80) then
      else
      h[1] = m[0X1][0B101110](T, m);
      h[0X2] = (m[1.0])[0x2e](T, m);
      end;
    end;
  end,gF = function(T, As, y, h)
  local F;
  local Q = 2124.0;
  while true do
    if Q <= 0XB66 then
      if Q == 2124.0 then
        F = {};
        for q =1, y do
          F[# F + 1] = { (As[0X1])[0x9](T, As),As[0x1][9.0](T, As),(As[0B1])[0x9](T, As),};
          end;
        (T.nK)[151.0] = (0x186bd454 + T:Xz(Q, T.sR, Q));
        Q = (T.nK)[151.0];
        end;
      else
      if Q == 0XB67 then
        for s,N in T.S(F) do
          local hC = 0;
          for H =N[1], (N[1] + N[2]) - 1 do
            hC = hC + 1;
            local c = As[1][54.0](T, As, T:v(As, N[3], hC), 127);
            h[3][H] = T:v(As, h[3][H], c);
            if not h[12][H] then
              h[5][H] = T:v(As, h[5][H], c);
              end;
            if not h[13][H] then
              h[4][H] = T:v(As, h[4][H], c);
              end;
            if not h[14][H] then
              h[10][H] = (As[0X1])[0x25](T, As, h[10][H], c);
              end;
            end;
          end;
        Q = (- 0x49cbff23 + ((T.sR[0B1101] == T.sR[14.0] and T.sR[0XC] or T.sR[0X7]) ~= T.sR[0XA] and T.sR[6.0] or T.sR[9.0]));
        T.nK[0B100100110] = Q;
        else
        if not (Q == 8341) then
          else
          h[15] = F;
          end;
        break;
        end;
      end;
    end;
  end,gX = function(T, s, n, F)
  F[0x1] = T.d(s[0x1][0b110001], s[0b1][33.0] - 1);
  (s)[0x1][0b100001] = (s[1.0])[0x21] + 8;
  end,i = tostring,iJ = function(T, T, z)
  local A = z[0B10];
  return { A,};
  end,nF = function(T, x, L, rM)
  local M = {};
  for Uk =1, L do
    (M)[Uk] = (x[1.0])[0X9](T, x);
    end;
  (rM)[16] = M;
  end,A = tonumber,o = function(T, c)
  local C = {};
  for R =59.0, 0B1110101101, 98 do
    T:cZ(c, R, C);
    end;
  return T:eE(c, C);
  end,iS = function(T, uP, Yy)
  if(not (uP < 262.0)) then
    if uP >= 0X1DA then
      (Yy[0X1])[7.0] = T.dM;
      elseif not (uP < 0X170) then
      (Yy[0x1])[47.0] = T.zN;
      else
      (Yy[1.0])[58.0] = T.gF;
      end;
    else
    if(uP >= 156.0) then
      ((Yy)[0b1])[0b10100] = T.Q;
      else
      if not (not (uP ~= 0b110010)) then
        else
        Yy[1.0][23.0] = (T.z);
        end;
      end;
    end;
  end,O = string.byte,}):V()(...);
