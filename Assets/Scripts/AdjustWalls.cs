using System.Collections;
using System.Collections.Generic;
using UnityEngine;

public class AdjustWalls : MonoBehaviour
{
    private Transform topWall, rightWall, downWall, leftWall;
    private float cameraHeight, cameraWidth;

    private void Awake()
    {
        cameraHeight = Camera.main.orthographicSize;
        cameraWidth = Camera.main.aspect * cameraHeight;

        topWall = transform.GetChild(0).gameObject.transform;
        rightWall = transform.GetChild(1).gameObject.transform;
        downWall = transform.GetChild(2).gameObject.transform;
        leftWall = transform.GetChild(3).gameObject.transform;
    }

    // Start is called before the first frame update
    void Start()
    {
        topWall.position = new Vector2(0f, -cameraHeight);
        topWall.Rotate(0, 0, 90);
        Vector3 vWallScale = topWall.localScale;
        vWallScale.y = cameraWidth * 2f;
        topWall.localScale = vWallScale;
        
        rightWall.position = new Vector2(cameraWidth, 0f);
        Vector3 hWallScale = rightWall.localScale;
        hWallScale.y = cameraHeight * 2f;
        rightWall.localScale = hWallScale;

        downWall.position = new Vector2(0f, cameraHeight);
        downWall.Rotate(0, 0, 90);
        downWall.localScale = vWallScale;

        leftWall.position = new Vector2(-cameraWidth, 0f);
        leftWall.localScale = hWallScale;
    }

    // Update is called once per frame
    void Update()
    {
        
    }
}
