# -*- coding: utf-8 -*-
import base64


def transform_image(path_to_image: str) -> None:
    with open(path_to_image, 'rb') as image:
        with open("image2base64code.txt", 'w', encoding='utf-8') as write_file:
            write_file.write(base64.b64encode(image.read()).decode('utf-8'))


if __name__ == '__main__':
    transform_image('button.png')
