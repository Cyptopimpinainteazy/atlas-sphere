# -*- coding: utf-8 -*-
from django.db import IntegrityError
from django.contrib.auth.models import User
from rest_framework.parsers import JSONParser
from rest_framework.authtoken.models import Token
from django.http import JsonResponse, HttpResponse
from django.views.decorators.csrf import csrf_exempt
from django.contrib.auth import authenticate
from secrets import token_urlsafe


@csrf_exempt
def register(request):
    if request.method == 'POST':
        try:
            data = JSONParser().parse(request)
            password = token_urlsafe(15)
            user = User.objects.create_user(
                username=data.get('username'),
                password=password,
            )
            user.save()
            return JsonResponse({"password": password}, status=201)
        except IntegrityError:
            return JsonResponse({
                "error": "Выбранное имя занято. Пожалуйста, выберите другое имя пользователя",
            }, status=400)
    return HttpResponse("<h1>No data to register in service</h1>")


@csrf_exempt
def login(request):
    if request.method == 'POST':
        data = JSONParser().parse(request)
        user = authenticate(
            request=request,
            username=data.get('username'),
            password=data.get('password'),
        )
        if user is None:
            return JsonResponse(
                {'error': "Невозможно авторизоваться. Проверьте имя пользователя или пароль"},
                status=400
            )
        token = None
        if user.is_staff:
            try:
                token = str(Token.objects.get(user=user))  # type: ignore
            except:
                token = str(Token.objects.create(user=user))  # type: ignore
        return JsonResponse(
            {
                "token": token,
                "success": "Вы успешно авторизовались" if token else "Вы успешно авторизовались!\n"
                                                                     "У Вас нет токена для запуска кликера!"
            }, status=201)
    return HttpResponse("<h1>No data to authorize in service</h1>")
